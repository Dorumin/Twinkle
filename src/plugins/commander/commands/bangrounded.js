const { SnowflakeUtil } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');
const CommandUtils = require('../structs/CommandUtils.js');

const CHECKMARK = '✅';
const CROSS = '❌';

class BanGroundedCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['bangrounded', 'bang', 'groundpound'];
        this.priority = 2;
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('after')
                    .setDescription('Message snowflake before the join message of the first grounded member to ban')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('days')
                    .setDescription('Number of days of messages to delete; must be between 0 and 7 (inclusive)')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Ban (and audit log) reason')
            );

        this.hidden = true;
        this.shortdesc = 'Bans recently joined grounded members.';
        this.desc = `
            Bans members (with the grounded role) who joined after the specified message snowflake.
            Include the number of days of messages to delete.
            Optionally, include a ban (and audit log) reason.
            You need to have the "Ban members" permission to use this command.`;
        this.usages = [
            '!bangrounded <after> <days> [reason]'
        ];
        this.examples = [
            '!bangrounded 901246138689134612 7',
            '!bangrounded 901246138689134612 7 Pathetic raid'
        ];
    }

    filter(message) {
        return this.isOperator(message) || message.guild && message.member.permissions.has('BAN_MEMBERS');
    }

    async call(message, content, { interaction }) {
        async function reply(content) {
            if (interaction) {
                return reply.message != null
                    ? interaction.editReply(content)
                    : reply.message = await interaction.reply(content);
            } else {
                return reply.message != null
                    ? reply.message.edit(content)
                    : reply.message = await message.channel.send(content);
            }
        }

        // `content` comes pre-trimmed, so we don't need to do any further trimming.
        const args = content.match(/^(\d{1,20})\s+([0-7])(?:\s+(.+))?$/);
        if (args[1] == null || args[2] == null) {
            await reply('You fucked up the args.');
            return;
        }
        const after = SnowflakeUtil.deconstruct(args[1]).timestamp;
        const isoAfter = new Date(after).toISOString();
        const days = parseInt(args[2], 10);
        const reason = args[3];

        // TODO: Make grounded role configurable.
        const membersToBan = [...await message.guild.roles.fetch('401231955741507604').values()]
            .filter(member => member.joinedTimestamp > after);
        if (membersToBan.length === 0) {
            await reply(`No grounded members joined after ${isoAfter}.`);
            return;
        }

        const description = `${membersToBan.length} grounded member${membersToBan.length !== 1 ? 's' : ''} who joined after ${isoAfter}`;
        const confirmation = await reply(`Ban ${description}?`);
        await CommandUtils.react(confirmation, CHECKMARK, CROSS);
        const reactions = await confirmation.awaitReactions({
            filter: (reaction, user) => {
                return user.id == message.author.id && [CHECKMARK, CROSS].includes(reaction.emoji.name);
            },
            time: 15000,
            max: 1
        });
        if (reactions.size === 0) {
            await Promise.all([
                reply('Your time ran out!'),
                CommandUtils.clearReactions(confirmation)
            ]);
            return;
        }

        const emoji = reactions.first().emoji;
        switch (emoji.name) {
            case CHECKMARK:
                await Promise.all([
                    reply(`Banning ${description}...`),
                    CommandUtils.clearReactions(confirmation),
                    ...membersToBan.map(member => member.ban({ days, reason }))
                ]);

                await reply(`Banned ${description}.`);
                break;
            case CROSS:
                await Promise.all([
                    reply('Command aborted.'),
                    CommandUtils.clearReactions(confirmation)
                ]);
                break;
        }
    }
}

module.exports = BanGroundedCommand;
