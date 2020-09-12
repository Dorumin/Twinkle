const Plugin = require('../../structs/Plugin.js');
const DatabasePlugin = require('../db');

class RestartNotifyPlugin extends Plugin {
    static get deps() {
        return [
            DatabasePlugin
        ];
    }

    load() {
        this.bot.restartNotify = new RestartNotify(this.bot);
    }
}

class RestartNotify {
    constructor(bot) {
        this.bot = bot;
        bot.client.on('ready', this.onReady.bind(this));
    }

    async onReady() {
        const channelId = await this.bot.db.get('lastRestartChannel');
        if (!channelId) return;

        this.bot.db.delete('lastRestartChannel');

        const channel = await this.bot.client.channels.fetch(channelId);
        if (!channel) return;

        channel.send('Restarted!');
    }
}

module.exports = RestartNotifyPlugin;
