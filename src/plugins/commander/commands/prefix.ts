import { SlashCommandBuilder } from '@discordjs/builders';
import { Message } from 'discord.js';
import Command from '../structs/Command';
import SQLPlugin, { SQLHandle } from '../../sql';
import FormatterPlugin from '../../fmt';
import Twinkle from '$src/Twinkle';
import CommanderPlugin, { CommandCallExtraPayload } from '..';

export default class PrefixCommand extends Command {
    private commander: CommanderPlugin;
    private fmt: FormatterPlugin;
    private sqlPlugin: SQLPlugin;
    private sql: SQLHandle<'getPrefixes' | 'setPrefixes'>;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['prefix', 'prefixes'];
        this.schema = new SlashCommandBuilder()
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('Lists the guild prefixes')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Adds a prefix')
                    .addStringOption(option =>
                        option.setName('prefix')
                            .setDescription('The prefix to add')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Removes a prefix')
                    .addStringOption(option =>
                        option.setName('prefix')
                            .setDescription('The prefix to remove')
                            .setRequired(true)
                    )
            );

        this.shortdesc = `Displays info about and updates guild prefixes`
        this.desc = `
                    Lets you update guild prefixes or view the existing ones.
                    If you happen to delete all the guild prefixes, you can ping the bot as an alternative prefix
                    I would advice you simply don't do that, though`;
        this.usages = [
            '!prefix list/add/remove [prefix]'
        ];
        this.examples = [
            '!prefixes',
            '!prefix list',
            '!prefix add twink!',
            '!prefix remove >'
        ];

        this.commander = bot.loadPlugin(CommanderPlugin);
        this.fmt = bot.loadPlugin(FormatterPlugin);
        this.sqlPlugin = bot.loadPlugin(SQLPlugin);
        this.sql = this.sqlPlugin.handle('prefix command')
            .with(
                'getPrefixes',
                `
                    SELECT prefixes_json
                    FROM commander_prefixes
                    WHERE
                        id = ?
                `,
                s => s.safeIntegers(true).pluck()
            )
            .with(
                'setPrefixes',
                `
                    REPLACE INTO commander_prefixes (id, prefixes_json)
                    VALUES ($id, $prefixes)
                `,
                s => s.safeIntegers()
            );
    }

    formatPrefixes(prefixes: string[]) {
        return prefixes.map(prefix => this.fmt.code(prefix)).join(' ');
    }

    async call(message: Message, content: string, { alias }: CommandCallExtraPayload) {
        if (!message.guild) return;
        if (!content) {
            content = 'list';
        }

        const split = content.split(' ');
        const prefix = split.slice(1).join(' ');

        let prefixes;
        {
            const json = message.guild && await this.sql.statement('getPrefixes').get(BigInt(message.guild.id));

            if (!json) {
                prefixes = this.commander.getDefaultPrefixes().slice();
            } else {
                prefixes = JSON.parse(json as string);
            }
        }

        switch (split[0]) {
            case 'list': {
                const formattedPrefixes = this.formatPrefixes(prefixes);

                await message.channel.send(`The prefixes for this guild are: ${formattedPrefixes}`);
                break;
            }
            case 'add': {
                if (!this.isAdmin(message)) {
                    await message.channel.send(`You're not an administrator. I'd suggest you become an administrator`);
                    break;
                }

                if (!prefix) {
                    await message.channel.send(`You did not provide a prefix. I'd suggest you provide a prefix`);
                    break;
                }

                if (prefixes.includes(prefix)) {
                    const formattedPrefixes = this.formatPrefixes(prefixes);
                    await message.channel.send(`The prefix is already present for this guild. Please pick another one`);
                    await message.channel.send(`The prefixes for this guild are: ${formattedPrefixes}`);
                    break;
                }

                prefixes.push(prefix);

                await this.sql.statement('setPrefixes').run({
                    id: BigInt(message.guild.id),
                    prefixes: JSON.stringify(prefixes)
                });

                const formattedPrefixes = this.formatPrefixes(prefixes);

                await message.channel.send(`The prefix ${this.fmt.code(prefix)} was added to this guild`);
                await message.channel.send(`The new prefixes for this guild are: ${formattedPrefixes}`);
                break;
            }
            case 'remove': {
                if (!this.isAdmin(message)) {
                    await message.channel.send(`You're not an administrator. I'd suggest you become an administrator`);
                    break;
                }

                if (!prefix) {
                    await message.channel.send(`You did not provide a prefix. I'd suggest you provide a prefix`);
                    break;
                }

                const prefixIndex = prefixes.indexOf(prefix);
                if (prefixIndex === -1) {
                    const formattedPrefixes = this.formatPrefixes(prefixes);
                    await message.channel.send(`The prefix is not present for this guild. Please pick one that exists`);
                    await message.channel.send(`The prefixes for this guild are: ${formattedPrefixes}`);
                    break;
                }

                prefixes.splice(prefixIndex, 1);

                await this.sql.statement('setPrefixes').run({
                    id: BigInt(message.guild.id),
                    prefixes: JSON.stringify(prefixes)
                });

                const formattedPrefixes = this.formatPrefixes(prefixes);

                await message.channel.send(`The prefix ${this.fmt.code(prefix)} has been removed from this guild`);
                await message.channel.send(`The new prefixes for this guild are: ${formattedPrefixes}`);
                break;
            }
            default:
                await message.channel.send(`No mode detected! Please provide a mode from \`list\`, \`add\`, or \`remove\`. You may try /help ${alias} or use the slash command version of /${alias}`);
                break;
        }
    }
}
