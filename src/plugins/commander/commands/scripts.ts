import { SlashCommandBuilder } from '@discordjs/builders';
import { Message } from 'discord.js';
import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';

export default class ScriptsCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['scripts'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Posts a link to the JS enhancement index.`;
        this.desc = `Posts a link to the JavaScript enhancement page on dev wiki.`;
        this.usages = [
            '!scripts'
        ];
    }

    async call(message: Message) {
        await message.channel.send(`You can find a list of JavaScript enhancements on <https://dev.fandom.com/wiki/List_of_JavaScript_enhancements>`);
    }
}
