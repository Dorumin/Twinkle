import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';
import { Message } from 'discord.js';
import FandomizerPlugin from '../../fandomizer';

export default class PersonalJSCommand extends Command {
    private fandomizer: FandomizerPlugin;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['personaljs', 'userjs'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('wiki')
                    .setDescription('The wiki to post links for')
            );

        this.shortdesc = `Lists links to personal JS pages.`;
        this.desc = `
            Lists all links for personal JS pages.
            If a wiki is provided, links will point to it. Otherwise, dev will be used.`;
        this.usages = [
            '!personaljs [wiki]'
        ];
        this.examples = [
            '!personaljs',
            '!personaljs c',
            '!personaljs doru',
        ];

        this.fandomizer = bot.loadPlugin(FandomizerPlugin);
    }

    async call(message: Message, content: string) {
        let wiki = content || 'dev',
        url = await this.fandomizer.url(wiki);

        return message.channel.send(`
Personal JavaScript pages are located on
- <${url}/wiki/Special:Mypage/common.js>
- <${url}/wiki/Special:Mypage/chat.js> (for chat)
- <https://community.fandom.com/wiki/Special:Mypage/global.js> (for all wikis)
${content ? '' : `You can replace dev.fandom with your wiki's URL to install your JavaScript on that wiki.\n`}
To enable personal JavaScript, go to <${url}/wiki/Special:Preferences>, in the Under the Hood section and search for "Enable personal JavaScript" option, check it and save your preferences.
        `);
    }
}
