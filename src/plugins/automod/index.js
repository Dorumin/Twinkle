const Plugin = require('../../structs/Plugin.js');

class AutoModPlugin extends Plugin {
    load() {
        this.bot.automod = new AutoMod(this.bot);
    }
}

class AutoMod {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.AUTOMOD;
        this.filters = this.config.FILTERS.map((module) => {
            const Filter = require(`./filters/${module}.js`);
            return new Filter(this);
        });

        bot.client.on('message', this.onMessage.bind(this));
    }

    logchan() {
        return this.bot.client.channels.get(this.config.LOGGING);
    }

    async onMessage(message) {
        // Ignore bots and self, and if there isn't a member property
        if (
            !message.guild ||
            message.author.bot ||
            message.author.id == this.bot.client.user.id
        ) return;

        // Fetch members not already in member cache
        if (!message.member) {
            const member = await message.guild.fetchMember(message.author.id);

            message.member = member;
        }

        this.filters.forEach(async (filter) => {
            const interest = filter.interested(message);
            let result;

            if (interest instanceof Promise) {
                result = await interest;
            } else {
                result = interest;
            }

            if (result) {
                filter.handle(message);
            }
        });
    }
}

module.exports = AutoModPlugin;