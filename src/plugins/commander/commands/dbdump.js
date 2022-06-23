const { MessageAttachment } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const OPCommand = require('../structs/OPCommand.js');
const SQLPlugin = require('../../sql');

class DBDumpCommand extends OPCommand {
    static get deps() {
        return [
            SQLPlugin
        ];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['dbdump'];
        this.schema = new SlashCommandBuilder();

        this.hidden = true;
        this.shortdesc = `Generates a database dump for a rainy day.`;
        this.desc = `
                    .`;
        this.usages = [
            '!dbdump'
        ];
        this.examples = [
            '!dbdump'
        ];

        this.sql = this.bot.sql.handle('dbdump command');
    }

    async call(message, content) {
        await message.channel.send({
            files: [
                new MessageAttachment(this.bot.sql.db.serialize(), 'sql.db')
            ]
        });
    }
}

module.exports = DBDumpCommand;
