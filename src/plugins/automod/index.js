const Plugin = require('../../structs/Plugin.js');

class AutoModPlugin extends Plugin {
    load() {
        this.bot.automod = new AutoMod(this.bot);
    }
}

class AutoMod {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'config', { value: bot.config.AUTOMOD });

        this.filters = this.config.FILTERS.map((module) => {
            const Filter = require(`./filters/${module}.js`);
            return new Filter(this);
        });

        bot.client.on('messageCreate', bot.wrapListener(this.onMessage, this));
    }

    logchan() {
        return this.bot.client.channels.fetch(this.config.LOGGING);
    }

    async onMessage(message) {
        // Ignore bots and self, and if there isn't a member property
        if (
            !message.guild ||
            !this.config.GUILDS.includes(message.guild.id) |
            message.author.bot ||
            message.author.id == this.bot.client.user.id
        ) return;

        // Fetch members not already in member cache
        if (!message.member) {
            const member = await message.guild.members.fetch(message.author.id);

            message.member = member;
        }

        this.filters.forEach(async (filter) => {
            const interest = filter.interested(message);
            let result;

            if (interest instanceof Promise) {
                try {
                    result = await interest;
                } catch (error) {
                    result = false;
                    await this.bot.reportError('Failed to fetch interest:', error);
                }
            } else {
                result = interest;
            }

            if (result) {
                try {
                    filter.handle(message);
                } catch (error) {
                    await this.bot.reportError('Failed to handle message:', error);
                }
            }
        });
    }
}

module.exports = AutoModPlugin;
