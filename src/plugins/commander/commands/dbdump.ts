import { Message, MessageAttachment } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import OPCommand from '../structs/OPCommand';
import SQLPlugin, { SQLHandle } from '../../sql';
import Twinkle from '$src/Twinkle';

export default class DBDumpCommand extends OPCommand {
    private sql: SQLHandle;
    private sqlPlugin: SQLPlugin;

    constructor(bot: Twinkle) {
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

        // We register a SQL handle just to keep track of it; we don't use it
        // We use the database directly to make a dump
        this.sqlPlugin = bot.loadPlugin<SQLPlugin>(SQLPlugin);
        this.sql = this.sqlPlugin.handle('dbdump command');
    }

    async call(message: Message, content: string) {
        await message.channel.send({
            files: [
                new MessageAttachment(this.sqlPlugin.db.serialize(), 'sql.db')
            ]
        });
    }
}
