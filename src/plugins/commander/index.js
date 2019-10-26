const fs = require('fs');
const path = require('path');
const Plugin = require('../../structs/Plugin.js');
const Collection = require('../../structs/Collection.js');
const Cache = require('../../structs/Cache.js');
const LoggerPlugin = require('../logger');
const DatabasePlugin = require('../db');
const FormatterPlugin = require('../fmt');

class CommanderPlugin extends Plugin {
    static get deps() {
        return [
            LoggerPlugin,
            DatabasePlugin,
            FormatterPlugin,
        ];
    }

    load() {
        this.bot.commander = new Commander(this.bot);
    }
}

class Commander {
    constructor(bot) {
        // this.all = fs.readdirSync(path.join(path.dirname(__dirname), 'commands'))
        //     .map(name => name.slice(0, -3));
        this.commands = new Collection();
        this.messageMatchers = new Cache();
        this.bot = bot;
        this.config = bot.config.COMMANDER;
        this.prefixes = this.config.PREFIXES;
        this.whitespace = [9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279];

        this.log = this.bot.logger.log.bind(this.bot.logger, 'commander');

        // if (this.config.commands) {
        //     if (this.config.commands == true) {
        //         if (this.config.blacklist) {
        //             this.all = this.all.filter(name => !this.config.blacklist.includes(name));
        //         }

        //         this.all.forEach(this.loadCommand.bind(this));
        //     } else {
        //         this.config.commands.forEach(this.loadCommand.bind(this));
        //     }
        //     this.sortCommandsByPriority();
        // }

        bot.client.on('message', this.onMessage.bind(this));
    }


    loadCommand(Command, name) {
        let log = `Loading command ${Command.name} ${name}.js`;
        const deps = Command.deps;

        if (deps.length) {
            log += `\nDependencies:\n${deps.map(plugin => `  - ${plugin.name}`).join('\n')}`;
        }

        this.log(log);

        deps.forEach(this.bot.loadPlugin.bind(this.bot));

        const command = new Command(this.bot);
        command.aliases = command.aliases.map(alias => alias.toLowerCase());

        this.commands.set(name, command);
    }

    loadCommandDir(dir) {
        fs.readdirSync(dir).forEach(file => {
            const p = path.join(dir, file);
            try {
                const Command = require(p);
                this.loadCommand(Command, file.slice(0, -3));
            } catch(e) {
                this.log(`Failure while parsing command: ${file}`);
                this.log(e.stack);
            }
        });

        this.sortCommandsByPriority();
    }

    sortCommandsByPriority() {
        this.commands = this.commands.sort((a, b) => b.priority - a.priority);
        this.validateCommandAliases();
    }

    validateCommandAliases() {
        const priorityAliases = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: []
        },
        aliasMap = {
            0: {},
            1: {},
            2: {},
            3: {},
            4: {}
        };
        this.commands.each(command => {
            if (!command.aliases.length) {
                this.log(`Command has no defined aliases: ${command}`);
                return;
            }

            command.aliases = command.aliases.filter(alias => {
                const conflicting = priorityAliases[command.priority].includes(alias);
                if (conflicting) {
                    this.log(`Duplicate alias: ${alias}`);
                    this.log(`Conflicting commands: ${aliasMap[command.priority][alias]} & ${command}`);
                    return false;
                }

                priorityAliases[command.priority].push(alias);
                aliasMap[command.priority][alias] = command;

                return true;
            });
        });
    }

    onMessage(message) {
        // Ignore bots and self
        if (
            message.author.bot ||
            message.author.id == this.bot.client.user.id
        ) return;

        return this.messageMatchers.get(message.id, () => this.tryMatchCommands(message));
    }

    async tryMatchCommands(message) {
        let text = message.content.trim(),
        prefixes = await this.getPrefixes(message.guild),
        i = prefixes.length,
        matched = false;

        while (i--) {
            const prefix = prefixes[i];
            if (text.slice(0, prefix.length) != prefix) continue;

            const trimmed = text.slice(prefix.length).trimLeft();
            for (const command of this.commands.values()) {
                const aliases = command.aliases;
                let i = aliases.length;

                while (i--) {
                    const alias = aliases[i];
                    // Ensure str[prefix..prefix+alias] == alias
                    if (trimmed.slice(0, alias.length).toLowerCase() != alias) continue;

                    const code = trimmed.charCodeAt(alias.length);
                    // Return if the character after the command isn't NaN (EOF) and isn't whitespace
                    if (code === code && !this.whitespace.includes(code)) continue;
                    // Filter function implemented by commands
                    if (!command.filter(message)) continue;
                    // Don't run commands for bots
                    if (!command.bot && message.author.bot) continue;

                    matched = true;
                    this.callCommand(command, message, trimmed.slice(alias.length + 1).trimLeft());
                }

                if (matched) break;
            }

            if (matched) break;
        }

        return matched;
    }

    async getPrefixes(guild) {
        const prefixes = guild
            ? await this.bot.db.get(`commander.prefixes.${guild.id}`, this.prefixes)
            : this.prefixes;

        if (this.config.MENTION) {
            const id = this.bot.client.user.id;
            prefixes.push(`<@${id}>`, `<@!${id}>`);
        }

        return prefixes;
    }

    getAlias(alias) {
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

    run(alias, message, content) {
        const command = this.getAlias(alias);
        if (!command) return;

        this.callCommand(command, message, content);
    }

    async callCommand(command, message, content) {
        try {
            await command.call(message, content.trim());
        } catch(e) {
            const lines = e.stack.split('\n'),
            firstRelevant = lines.findIndex(line => line.includes('Commander.callCommand')),
            relevantLines = lines.slice(0, firstRelevant),
            errorMessage = `${command.constructor.name}CallError: ${relevantLines.join('\n')}`;

            this.bot.logger.log('commander', errorMessage);

            if (this.config.INLINE_ERRORS) {
                message.channel.send(this.bot.fmt.codeBlock('apache', errorMessage));
            }
        }
    }
}

module.exports = CommanderPlugin;
