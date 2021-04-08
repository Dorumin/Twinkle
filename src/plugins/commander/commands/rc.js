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
        this.aliases = ['rc', 'rssbot', 'rctodiscord', 'rcscript'];

        this.shortdesc = `Information on setting up RC-to-Discord relay.`;
        this.desc = `Tells you how to successfully set up a RC-to-Discord relay system.`;
        this.usages = [
            '!rc'
        ];
    }

    async call(message, content) {
        const link = content
            ? `<${await this.bot.fandomizer.url(content)}/wiki/Special:RecentChanges?feed=rss>`
            : this.bot.fmt.code('https://<yourwiki>.fandom.com/wiki/Special:RecentChanges?feed=rss');

        message.channel.send(`
The easiest way to set up a Recent Changes-to-Discord system is by inviting Wiki-Bot (<https://wikibot.fandom.com/wiki/Wiki-Bot_Wiki>) to your server and setting up its recent changes webhook.
More information is available on the Wiki-Bot Wiki: <https://wikibot.fandom.com/wiki/Recent_changes_webhook>.

Another way is inviting and configuring an RSS bot for your server. A popular one is <https://monitorss.xyz/>.
When the bot prompts you for the RSS feed/URL, enter ${link} in. Note that, unlike <#246076868560814080>, this bot has a small delay, usually around 10 minutes.
        `);
    }
}

module.exports = RCCommand;
