import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';
import { Message } from 'discord.js';
import FandomizerPlugin from '../../fandomizer';

export default class PersonalCSSCommand extends Command {
    private fandomizer: FandomizerPlugin;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['personalcss', 'usercss'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('wiki')
                    .setDescription('The wiki to post links for')
            );

        this.shortdesc = `Lists links to personal CSS pages.`;
        this.desc = `
            Lists all links for personal CSS pages.
            If a wiki is provided, links will point to it. Otherwise, dev will be used.`;
        this.usages = [
            '!personalcss [wiki]'
        ];
        this.examples = [
            '!personalcss',
            '!personalcss c',
            '!personalcss doru',
        ];

        this.fandomizer = bot.loadPlugin(FandomizerPlugin);
    }

    async call(message: Message, content: string) {
        const wiki = content || 'dev';
        const url = await this.fandomizer.url(wiki);

        return message.channel.send(`
Personal CSS pages are located on
- <${url}/wiki/Special:Mypage/common.css>
- <${url}/wiki/Special:Mypage/chat.css> (for chat)
- <https://community.fandom.com/wiki/Special:Mypage/global.css> (for all wikis)
${content ? '' : `You can replace dev.fandom.com with your wiki's URL to install your CSS on that wiki.`}
        `);
    }
}
