import fs from 'fs';
import path from 'path';

import cleanStack from 'clean-stack';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import * as t from 'io-ts';

import Plugin from '../../structs/Plugin';
import LoggerPlugin from '../logger';
import SQLPlugin, { AsyncStatement, SQLHandle } from '../sql';
import FormatterPlugin from '../fmt';
import BlacklistPlugin from '../blacklist';
import InteractionCompatibilityLayer from './structs/InteractionCompatibilityLayer';
import Twinkle from '../../Twinkle';
import { ConfigProvider } from '../../structs/Config';
import { definePrivate } from '../../util/define';

import { CacheType, CommandInteraction, Guild, Interaction, Message } from 'discord.js';
import Command from './structs/Command';

const WHITESPACE = [9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279];

const CommanderConfigSchema = t.intersection([
    t.type({
        MENTION: t.boolean,
        INLINE_ERRORS: t.boolean,
        PREFIXES: t.array(t.string)
    }),
    t.partial({
        WHITELIST: t.array(t.string),
        BLACKLIST: t.array(t.string)
    })
]);

export type CommandCallExtraPayload = {
    alias: string;
    interaction?: CommandInteraction<CacheType>;
    compat?: InteractionCompatibilityLayer;
}

export default class CommanderPlugin extends Plugin {
    private logger!: LoggerPlugin;
    private fmt!: FormatterPlugin;
    private blacklist!: BlacklistPlugin;
    private sqlPlugin!: SQLPlugin;
    private sql: SQLHandle;

    private commanderConfig: t.TypeOf<typeof CommanderConfigSchema>;
    public commands: Map<string, Command>;

    private log: (message: string) => void;
    private getPrefixesSql: AsyncStatement;

    private handledMessages: WeakMap<Message, boolean>;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        definePrivate(this, 'logger', bot.loadPlugin(LoggerPlugin));
        definePrivate(this, 'fmt', bot.loadPlugin(FormatterPlugin));
        definePrivate(this, 'blacklist', bot.loadPlugin(BlacklistPlugin));
        definePrivate(this, 'sqlPlugin', bot.loadPlugin(SQLPlugin));

        this.commanderConfig = config.getOptionTyped('COMMANDER', CommanderConfigSchema);

        this.commands = new Map();

        this.handledMessages = new WeakMap();

        this.log = this.logger.handle('commander');

        this.sql = this.sqlPlugin.handle('commander');
        this.sql.exec(`CREATE TABLE IF NOT EXISTS commander_prefixes (
            id INTEGER PRIMARY KEY,
            prefixes_json TEXT NOT NULL
        )`);

        this.getPrefixesSql = this.sql.prepare(`
            SELECT prefixes_json
            FROM commander_prefixes
            WHERE
                id = ?
        `).safeIntegers(true).pluck();
    }

    async load() {
        this.bot.listen('ready', this.registerSlashCommands, this);
        this.bot.listen('messageCreate', this.onMessage, this);
        this.bot.listen('interactionCreate', this.onInteraction, this);

        for (const command of this.commands.values()) {
            await command.load();
        }
    }

    async cleanup() {
        for (const command of this.commands.values()) {
            await command.cleanup();
        }
    }

    async onInteraction(interaction: Interaction) {
        if (!interaction.isCommand()) return;

        const command = this.getAlias(interaction.commandName);
        if (!command) return;

        const compat = new InteractionCompatibilityLayer(interaction);

        // Rights check or whatever for commands
        // Compat is compatible with the Message interface
        if (!command.filter(compat as unknown as Message)) return;

        // No blacklisted
        if (this.blacklist.isBlacklistedUser(compat.author)) return;

        this.callCommand(command, compat as unknown as Message, compat._unprefixedContent, {
            alias: interaction.commandName,
            interaction: interaction,
            compat
        });
    }

    async registerSlashCommands() {
        const commands = Array.from(this.commands.values()).filter(command => command.schema);
        if (commands.length === 0) return;

        commands.forEach(command => {
            if (command.schema.name === undefined) {
                command.schema.setName(command.aliases[0]);
            }

            if (command.schema.description === undefined) {
                command.schema.setDescription(command.shortdesc);
            }
        });

        if (!this.bot.client.token || !this.bot.client.application) return;

        const rest = new REST({ version: '9' }).setToken(this.bot.client.token);

        try {
            await rest.put(
                Routes.applicationCommands(this.bot.client.application.id),
                {
                    body: commands.map(c => c.schema.toJSON())
                }
            );
        } catch(e) {
            console.error('Failed while registering slash commands');
            console.error(e);
        }
    }

    getDefaultPrefixes(): string[] {
        return this.commanderConfig.PREFIXES;
    }

    loadCommand(NewCommand: typeof Command, name: string) {
        let log = `Loading command ${NewCommand.name} ${name}`;

        this.log(log);

        // @ts-expect-error Don't call this with the base class
        const command: Command = new NewCommand(this.bot);
        command.aliases = command.aliases.map(alias => alias.toLowerCase());
        command.validate();

        this.commands.set(name, command);
    }

    loadCommandDir(dir: string) {
        const wl = this.commanderConfig.WHITELIST;
        const bl = this.commanderConfig.BLACKLIST;

        fs.readdirSync(dir).forEach((file) => {
            const p = path.join(dir, file);
            const name = file.replace(/\.js$/, '');
            if (wl instanceof Array && !wl.includes(name)) {
                return;
            }
            if (bl instanceof Array && bl.includes(name)) {
                return;
            }
            try {
                let Cmd = require(p);

                if ('default' in Cmd && Cmd.default.prototype instanceof Command) {
                    Cmd = Cmd.default;
                }

                this.loadCommand(Cmd, file.slice(0, -3));
            } catch(e) {
                this.log(`Failure while parsing command: ${file}`);
                this.log(String((e as Error).stack));
            }
        });

        this.sortCommandsByPriority();
    }

    sortCommandsByPriority() {
        this.commands = new Map(
            Array.from(this.commands.entries())
                .sort((a, b) => b[1].priority - a[1].priority)
        );
        this.validateCommandAliases();
    }

    validateCommandAliases() {
        const priorityAliases: Record<number, string[]> = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: []
        };
        const aliasMap: Record<number, Record<string, Command>> = {
            0: {},
            1: {},
            2: {},
            3: {},
            4: {}
        };

        for (const command of this.commands.values()) {
            if (!command.aliases.length) {
                this.log(`Command has no defined aliases: ${command}`);
                continue;
            }

            command.aliases = command.aliases.filter(alias => {
                const conflicting = priorityAliases[command.priority].includes(alias);

                if (conflicting) {
                    this.log(`Duplicate alias: ${alias}`);
                    this.log(`Conflicting commands: ${aliasMap[command.priority][alias].constructor.name} & ${command.constructor.name}`);
                    return false;
                }

                priorityAliases[command.priority].push(alias);
                aliasMap[command.priority][alias] = command;

                return true;
            });
        }
    }

    async onMessage(message: Message) {
        // Ignore bots and self
        if (
            message.author.bot ||
            message.author.id === this.bot.client.user?.id
        ) return false;

        console.log(this.bot.onlyDev(message));

        // Ignore in dev mode if outside of dev guild or not by operator in DMs
        if (this.bot.onlyDev(message)) return false;

        if (this.handledMessages.has(message)) {
            return this.handledMessages.get(message)!;
        } else {
            return await this.tryMatchCommands(message);
        }
    }

    async tryMatchCommands(message: Message) {
        const text = message.content.trim();
        const prefixes = await this.getPrefixes(message.guild);
        let i = prefixes.length;
        let matched: boolean = false;

        console.log('try match', prefixes);

        while (i--) {
            const prefix = prefixes[i];
            if (text.slice(0, prefix.length) !== prefix) continue;

            const trimmed = text.slice(prefix.length).trimStart();
            for (const command of this.commands.values()) {
                const aliases = command.aliases;
                let i = aliases.length;

                while (i--) {
                    const alias = aliases[i];

                    // Ensure str[prefix..prefix+alias] == alias
                    if (trimmed.slice(0, alias.length).toLowerCase() != alias) continue;

                    const code = trimmed.charCodeAt(alias.length);
                    // Return if the character after the command isn't NaN (EOF) and isn't whitespace
                    if (code === code && !WHITESPACE.includes(code)) continue;

                    console.log(alias, code, command.filter(message));

                    // Filter function implemented by commands
                    if (!command.filter(message)) continue;
                    // Don't run commands for bots
                    if (message.author.bot) continue;
                    // No blacklisted
                    if (this.blacklist.isBlacklistedUser(message.author)) continue;

                    console.log('match');

                    matched = true;

                    const content = trimmed.slice(alias.length + 1).trimLeft();

                    this.callCommand(command, message, content, {
                        alias
                    });
                }

                if (matched) break;
            }

            if (matched) break;
        }

        return matched;
    }

    async getPrefixes(guild: Guild | null) {
        await this.sqlPlugin.ready();

        let prefixes;
        {
            const json = guild && await this.getPrefixesSql.get(guild.id);

            if (!json) {
                prefixes = this.commanderConfig.PREFIXES;
            } else {
                prefixes = JSON.parse(json as string);
            }
        }

        if (this.commanderConfig.MENTION && this.bot.client.user) {
            const id = this.bot.client.user.id;
            return prefixes.concat([
                `<@${id}>`,
                `<@!${id}>`
            ]);
        }

        return prefixes;
    }

    getAlias(alias: string) {
        for (const command of this.commands.values()) {
            const aliases = command.aliases;
            let i = aliases.length;

            while (i--) {
                if (aliases[i] == alias) {
                    return command;
                }
            }
        }

        return null;
    }

    run(alias: string, message: Message, content: string) {
        const command = this.getAlias(alias);
        if (!command) return;

        return this.callCommand(command, message, content);
    }

    async callCommand(command: Command, message: Message, content: string, extra?: CommandCallExtraPayload) {
        try {
            await command.call(message, content.trim(), extra ?? { alias: '' });
        } catch(e) {
            const lines = String((e as Error).stack).split('\n');
            const firstRelevant = lines.findIndex(line => line.includes('Commander.callCommand'));
            const relevantLines = lines.slice(0, firstRelevant);
            const errorMessage = `${command.constructor.name}CallError: ${cleanStack(relevantLines.join('\n'))}`;

            this.log(errorMessage);

            if (this.commanderConfig.INLINE_ERRORS) {
                await message.channel.send(this.fmt.codeBlock('apache', errorMessage));
            } else {
                await this.bot.reportError(`Error while executing ${command.constructor.name}:`, e as Error);
            }
        }
    }
}
