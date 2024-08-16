import { MessageActionRow, MessageButton, SnowflakeUtil, Message } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '../../../Twinkle';
import Command from '../structs/Command';
import { CommandCallExtraPayload } from '..';

export default class BanGroundedCommand extends Command {
    constructor(bot: Twinkle) {
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

    filter(message: Message) {
        return this.isOperator(message) || message.member && message.member.permissions.has('BAN_MEMBERS') || false;
    }

    async call(message: Message, content: string, { interaction }: CommandCallExtraPayload) {
        // async function reply(options) {
        //     if (interaction) {
        //         return reply.message != null
        //             ? interaction.editReply(options)
        //             : reply.message = await interaction.reply(options);
        //     } else {
        //         return reply.message != null
        //             ? reply.message.edit(options)
        //             : reply.message = await message.channel.send(options);
        //     }
        // }

        if (!message.guild) return;

        async function confirm(content: string) {
            const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('NO')
                        .setLabel('Cancel')
                        .setStyle('SECONDARY'),
                    new MessageButton()
                        .setCustomId('YES')
                        .setLabel('Ban')
                        .setStyle('DANGER')
                );
            const confirmation = await message.channel.send({
                content,
                components: [row]
            });

            return confirmation.awaitMessageComponent({
                filter: ({ user, customId }) => {
                    return user.id === message.author.id && ['NO', 'YES'].includes(customId);
                },
                time: 15000,
                componentType: 'BUTTON'
            }).then(async interaction => {
                await confirmation.edit({
                    content,
                    components: []
                });
                return interaction.customId === 'YES';
            }).catch(async e => {
                await confirmation.edit({
                    content: 'Your time ran out!',
                    components: []
                });

                return undefined;
            });
        }

        // `content` comes pre-trimmed, so we don't need to do any further trimming.
        const args = content.match(/^(\d{1,20})\s+([0-7])(?:\s+(.+))?$/);
        if (args == null) {
            await message.channel.send('You fucked up the args.');
            return;
        }

        let after;
        if (
            Number(args[1])
            && Number(args[1]) < Date.now()
            && Number(args[1]) > new Date(2015, 0, 1).getTime()
        ) {
            after = Number(args[1]);
        } else {
            after = SnowflakeUtil.deconstruct(args[1]).timestamp;
        }

        const secondsSince = Math.floor(new Date(after).getTime() / 1000);
        const discordTime = `<t:${secondsSince}:F> (<t:${secondsSince}:R>)`;
        const days = parseInt(args[2], 10);
        const reason = args[3];

        // if (interaction) {
        //     await interaction.deferReply();
        // }

        // TODO: Make grounded role configurable.
        const role = await message.guild.roles.fetch('401231955741507604');
        if (role === null) return;

        const membersToBan = [...role.members.values()]
            .filter(member => member.joinedTimestamp && member.joinedTimestamp > after);

        if (membersToBan.length === 0) {
            await message.channel.send(`No grounded members joined after ${discordTime}.`);
            return;
        }

        const description = `${membersToBan.length} grounded member${membersToBan.length !== 1 ? 's' : ''} who joined after ${discordTime}`;
        const confirmed = await confirm(`Ban ${description}?`);
        if (confirmed == null) {
            return;
        }

        if (confirmed) {
            const [banning] = await Promise.all([
                message.channel.send(`Banning ${description}...`),
                ...membersToBan.map(member => member.ban({ days, reason }))
            ]);
            await banning.edit(`Banned ${description}.`);
        } else {
            await message.channel.send('Command aborted.');
        }
    }
}
