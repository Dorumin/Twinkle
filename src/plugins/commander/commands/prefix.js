const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');
const SQLPlugin = require('../../sql');
const FormatterPlugin = require('../../fmt');

class PrefixCommand extends Command {
    static get deps() {
        return [
            SQLPlugin,
            FormatterPlugin
        ];
    }

    constructor(bot) {
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

        this.sql = this.bot.sql.handle('prefix command');
        this.sql.getPrefixes = this.sql.prepare(`
            SELECT prefixes_json
            FROM commander_prefixes
            WHERE
                id = ?
        `).safeIntegers(true).pluck();
        this.sql.setPrefixes = this.sql.prepare(`
            REPLACE INTO commander_prefixes
            VALUES ($id, $prefixes)
        `).safeIntegers(true);
    }

    formatPrefixes(prefixes) {
        return prefixes.map(prefix => this.bot.fmt.code(prefix)).join(' ');
    }

    async call(message, content, { alias }) {
        if (!content) {
            content = 'list';
        }

        const split = content.split(' ');
        const prefix = split.slice(1).join(' ');

        let prefixes;
        {
            const json = message.guild && await this.sql.getPrefixes.get(BigInt(message.guild.id));

            if (!json) {
                prefixes = this.bot.commander.defaultPrefixes;
            } else {
                prefixes = JSON.parse(json);
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

                await this.sql.setPrefixes.run({
                    id: BigInt(message.guild.id),
                    prefixes: JSON.stringify(prefixes)
                });

                const formattedPrefixes = this.formatPrefixes(prefixes);

                await message.channel.send(`The prefix ${this.bot.fmt.code(prefix)} was added to this guild`);
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

                await this.sql.setPrefixes.run({
                    id: BigInt(message.guild.id),
                    prefixes: JSON.stringify(prefixes)
                });

                const formattedPrefixes = this.formatPrefixes(prefixes);

                await message.channel.send(`The prefix ${this.bot.fmt.code(prefix)} has been removed from this guild`);
                await message.channel.send(`The new prefixes for this guild are: ${formattedPrefixes}`);
                break;
            }
            default:
                await message.channel.send(`No mode detected! Please provide a mode from \`list\`, \`add\`, or \`remove\`. You may try /help ${alias} or use the slash command version of /${alias}`);
                break;
        }
    }
}

module.exports = PrefixCommand;
