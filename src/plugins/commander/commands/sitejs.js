const Command = require('../structs/command.js');

class SiteJSCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['sitejs'];

        this.shortdesc = 'Lists links to sitewide JS pages.';
        this.desc = 'Lists all links for sitewide JS pages.\nIf a wiki is provided, links will point to it. Otherwise, dev will be used.';
        this.usages = [
            '!sitejs [wiki]'
        ];
        this.examples = [
            '!sitejs',
            '!sitejs c',
            '!sitejs doru',
        ];
    }

    async call(message) {
        let wiki = content || 'dev',
        url = await this.bot.fandomizer.url(wiki);

        message.channel.send(`
Wiki-wide JavaScript pages can be found on:
- <https://${url}/wiki/MediaWiki:Common.js>
- <https://${url}/wiki/MediaWiki:Chat.js> (for chat)
The preferred way of importing JavaScript is <https://${url}/wiki/MediaWiki:ImportJS> and for instructions on how to use it, see <https://community.fandom.com/wiki/Help:ImportJS>
${content ? '' : `You can replace dev.fandom with your wiki's URL to install your JavaScript on that wiki.\n`}
If you are an administrator of a wiki, you can enable custom JavaScript on your wiki by contacting Staff through <https://${content ? url : 'community.fandom.com'}/wiki/Special:Contact/general>. Don't forget to link to the wiki you want to enable it on!
        `);
    }
}

module.exports = SiteJSCommand;