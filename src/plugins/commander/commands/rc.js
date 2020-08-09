const Command = require('../structs/Command.js');

class RCCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['rc', 'rssbot', 'rctodiscord'];

        this.shortdesc = `Information on setting up Recent Changes-to-Discord.`;
        this.desc = `Tells you how to successfully set up a Recent Changes-to-Discord system.`;
        this.usages = [
            '!rc'
        ];
    }

    call(message) {
        message.channel.send(`
The easiest way to set up a Recent Changes-to-Discord system is by inviting and configuring an RSS bot for your server. A popular one is <https://discordrss.xyz/>.
When the bot prompts you for the RSS feed/url, enter ${bot.fmt.code('https://<yourwiki>.fandom.com/wiki/Special:Recentchanges?feed=rss')} in. Note that, unlike <#246076868560814080>, the bot will have a small delay, usually around 10 minutes.
        `);
    }
}

module.exports = RCCommand;
