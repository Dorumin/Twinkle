const Command = require('../structs/command.js');

class SiteJSCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['sitejs'];
    }

    call(message) {
        message.channel.send(`
Wiki-wide JavaScript pages can be found on:
- <https://dev.fandom.com/wiki/MediaWiki:Common.js>
- <https://dev.fandom.com/wiki/MediaWiki:Chat.js> (for chat)
The preferred way of importing JavaScript is <https://dev.fandom.com/wiki/MediaWiki:ImportJS> and for instructions on how to use it, see <https://c.fandom.com/wiki/Help:ImportJS>
You can replace dev.fandom with your wiki's URL to install your JavaScript on that wiki.

If you are an administrator of a wiki, you can enable custom JavaScript on your wiki by contacting Staff through <https://c.fandom.com/wiki/Special:Contact/general>. Don't forget to link to the wiki you want to enable it on!
        `);
    }
}

module.exports = SiteJSCommand;