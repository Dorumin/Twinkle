const Command = require('../structs/Command.js');
const FandomizerPlugin = require('../../fandomizer');
const FormatterPlugin = require('../../fmt');

class RCCommand extends Command {
    static get deps() {
        return [
            FandomizerPlugin,
            FormatterPlugin
        ];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['rc', 'rssbot', 'rctodiscord'];

        this.shortdesc = `Information on setting up RC-to-Discord relay.`;
        this.desc = `Tells you how to successfully set up a RC-to-Discord relay system.`;
        this.usages = [
            '!rc'
        ];
    }

    async call(message, content) {
        const link = content
            ? `<${await this.bot.fandomizer.url(content)}.fandom.com/wiki/Special:RecentChanges?feed=rss>`
            : this.bot.fmt.code('https://<yourwiki>.fandom.com/wiki/Special:RecentChanges?feed=rss');

        message.channel.send(`
The easiest way to set up a Recent Changes-to-Discord system is by inviting and configuring an RSS bot for your server. A popular one is <https://discordrss.xyz/>.
When the bot prompts you for the RSS feed/url, enter ${link} in. Note that, unlike <#246076868560814080>, the bot will have a small delay, usually around 10 minutes.
        `);
    }
}

module.exports = RCCommand;
