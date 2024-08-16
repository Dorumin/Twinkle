import { SlashCommandBuilder } from '@discordjs/builders';
import { Message } from 'discord.js';

import Command from '../structs/Command';
import Twinkle from '$src/Twinkle';

export default class XKCDCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['xkcd', 'theresanxkcdforthat'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('search')
                    .setDescription('The search query or xkcd post number')
            );

        this.shortdesc = 'You know how the old saying goes...';
        this.desc = `... *There's an xkcd for that*

            Searches XKCD for a matching keyword or name.
            If input is a number, the number's link will be sent.
        `;
		this.usages = [
			'!xkcd [input]'
        ];
        this.examples = [
            '!xkcd lisp',
            '!xkcd 537'
        ];
    }

    async call(message: Message, content: string) {
        if (!content) {
            await message.channel.send('https://xkcd.com/');
            return;
        }

        if (!Number.isNaN(parseInt(content))) {
            await message.channel.send(`https://xkcd.com/${content}`);
            return;
        }

        await message.channel.send('XCKD search dieded. Ask someone to scrape explainxkcd.com');
    }
}
