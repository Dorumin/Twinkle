const Plugin = require('../../structs/Plugin.js');

class PreloadPlugin extends Plugin {
	load() {
		this.bot.preload = new Preload(this.bot);
	}
}

class Preload {
	constructor(bot) {
		this.bot = bot;
		this.config = bot.config.PRELOAD;

		bot.client.on('ready', this.onReady.bind(this));
	}

	onReady() {
		this.config.GUILDS.forEach(this.preloadUsers.bind(this));
	}

	async preloadUsers(guildId) {
		const guild = await this.bot.client.guilds.fetch(guildId);
		if (!guild) return;

		try {
			await guild.members.fetch();
		} catch (error) {
			console.error('Failed to preload guild', guildId, 'have you enabled the guild members intent?', error);
		}
	}
}

module.exports = PreloadPlugin;
