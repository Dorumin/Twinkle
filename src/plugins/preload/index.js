const Plugin = require('../../structs/Plugin.js');

class PreloadPlugin extends Plugin {
    load() {
        this.bot.preload = new Preload(this.bot);
    }
}

class Preload {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'config', { value: bot.config.PRELOAD });

        bot.listen('ready', this.onReady, this);
    }

    async onReady() {
        this.intervalId = setInterval(async () => {
            for (const guildId of this.config.GUILDS) {
                await this.preloadUsers(guildId);
            }
        }, 1000 * 60 * 60 * 6);
    }

    async preloadUsers(guildId) {
        const guild = await this.bot.client.guilds.fetch(guildId);
        if (!guild) return;

        try {
            await guild.members.fetch();
        } catch (error) {
            await this.bot.reportError(`Failed to preload guild ${guildId}. Have you enabled the guild members intent?`, error);
        }
    }
}

module.exports = PreloadPlugin;
