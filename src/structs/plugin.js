class Plugin {
    constructor(bot) {
        this.bot = bot;
        this.client = bot.client;
        this.config = bot.config;
    }

    load() {
        throw new Error('load() not implemented');
    }
}

module.exports = Plugin;