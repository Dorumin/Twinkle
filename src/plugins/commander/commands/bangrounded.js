const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

class BanGroundedCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['bangrounded', 'ban', 'groundpound'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('after')
                    .setDescription('Message snowflake before the first grounded user to ban')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Ban (and audit log) reason')
            );

        this.hidden = true;
        this.shortdesc = 'Bans recently joined grounded users.';
        this.desc = `
            Bans users (with the grounded role) who joined after the specified message snowflake.
            Optionally, include a ban (and audit log) reason.
            You need to have the "Ban members" permission to use this command.`;
        this.usages = [
            '!bangrounded <after> [reason]'
        ];
        this.examples = [
            '!bangrounded 901246138689134612',
            '!bangrounded 901246138689134612 Pathetic raid'
        ];
    }

    filter(message) {
        return this.isOperator(message) || message.guild && message.member.permissions.has('BAN_MEMBERS');
    }
}

module.exports = BanGroundedCommand;
