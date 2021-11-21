const Plugin = require('../../structs/Plugin.js');
const SQLPlugin = require('../sql');

const lastRestartChannelCmd = process.argv
    .map(arg => arg.split('='))
    .find(arg => arg[0] === '--last-restart-channel');

class RestartNotifyPlugin extends Plugin {
    static get deps() {
        return lastRestartChannelCmd ?
            [] :
            [
                SQLPlugin
            ];
    }

    load() {
        this.bot.restartNotify = new RestartNotify(this.bot);
    }
}

class RestartNotify {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });

        if (!lastRestartChannelCmd) {
            this.sql = this.bot.sql.handle('restartnotify');
            this.sql.exec(`CREATE TABLE IF NOT EXISTS last_restart (
                id INTEGER PRIMARY KEY,
                channel_id INTEGER NOT NULL
            )`);

            this.sql.getLastRestart = this.sql.prepare(`
                SELECT channel_id
                FROM last_restart
                WHERE
                    id = 1
            `).safeIntegers(true).pluck();
            this.sql.deleteLastRestart = this.sql.prepare(`
                DELETE FROM last_restart
                WHERE
                    id = 1
            `);
        }

        bot.listen('ready', this.onReady, this);
    }

    async onReady() {
        try {
            let channelId;

            if (lastRestartChannelCmd) {
                channelId = lastRestartChannelCmd[1];
            } else {
                channelId = await this.sql.getLastRestart.get();
                if (!channelId) return;

                await this.sql.deleteLastRestart.run();
            }

            const channel = await this.bot.client.channels.fetch(channelId);
            if (!channel) return;

            await channel.send('Restarted!');
        } catch(e) {
            console.error('wat');
            console.error(e);
        }
    }
}

module.exports = RestartNotifyPlugin;
