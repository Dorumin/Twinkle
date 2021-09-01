class Plugin {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'client', { value: bot.client });
        Object.defineProperty(this, 'config', { value: bot.config });
    }

    static get deps() {
        return [];
    }

    load() {
        throw new Error('load() not implemented');
    }

    cleanup() {}
}

module.exports = Plugin;
