import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';
import { Message } from 'discord.js';
import FandomizerPlugin from '../../../plugins/fandomizer';

export default class SiteJSCommand extends Command {
    private fandomizer: FandomizerPlugin;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['sitejs'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('wiki')
                    .setDescription('The wiki to post sitewide js pages of')
            );

        this.shortdesc = `Lists links to sitewide JS pages.`;
        this.desc = `
            Lists all links for sitewide JS pages.
            If a wiki is provided, links will point to it. Otherwise, dev will be used.`;
        this.usages = [
            '!sitejs [wiki]'
        ];
        this.examples = [
            '!sitejs',
            '!sitejs c',
            '!sitejs doru',
        ];

        this.fandomizer = bot.loadPlugin(FandomizerPlugin);
    }

    async call(message: Message, content: string) {
        const wiki = content || 'dev';
        const url = await this.fandomizer.url(wiki);

        return message.channel.send(`
Wiki-wide JavaScript pages can be found on:
- <${url}/wiki/MediaWiki:Common.js>
- <${url}/wiki/MediaWiki:Chat.js> (for chat)
The preferred way of importing JavaScript is <${url}/wiki/MediaWiki:ImportJS> and for instructions on how to use it, see <https://community.fandom.com/wiki/Help:ImportJS>
${content ? '' : `You can replace dev.fandom with your wiki's URL to install your JavaScript on that wiki.\n`}
If you are an administrator of a wiki, you can enable custom JavaScript on your wiki by contacting Staff through <${content ? url : 'https://community.fandom.com'}/wiki/Special:Contact/general>. Don't forget to link to the wiki you want to enable it on!
        `);
    }
}
