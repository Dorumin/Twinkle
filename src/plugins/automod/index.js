const Plugin = require('../../structs/plugin.js');

class AutoModPlugin extends Plugin {
    load() {
        this.bot.automod = new AutoMod(this.bot);
    }
}

class AutoMod {
    constructor(bot) {
        this.config = bot.config.AUTOMOD;
        this.filters = this.config.FILTERS.map((module) => {
            const Filter = require(`./filters/${module}.js`);
            return new Filter(this);
        });

        bot.client.on('message', this.onMessage.bind(this));
    }

    onMessage(message) {
        this.filters.forEach(filter => {
            if (filter.interested(message)) {
                filter.handle(message);
            }
        });
    }
}

module.exports = AutoModPlugin;