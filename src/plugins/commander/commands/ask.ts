import Twinkle from '../../../Twinkle';
import Command from '../structs/Command';
import { Message } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

export default class AskCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['ask'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Please don't ask to ask, just ask.`;
        this.desc = `Links to a website where it is advised to just ask your question and wait if someone can answer it.`;
        this.usages = [
            '!ask'
        ];
    }

    call(message: Message) {
        message.channel.send(`
Please don't ask if you may ask or ask for people who "know" x, y, or z. Just ask your question and somebody may be able to answer it.
<http://iki.fi/sol/dontask.html>
        `);
    }
}