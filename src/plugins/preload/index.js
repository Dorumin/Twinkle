const Plugin = require('../../structs/Plugin.js');

class RemindersPlugin extends Plugin {
	load() {
		this.bot.preload = new Reminders(this.bot);
	}
}

class Reminders {
	constructor(bot) {
		this.bot = bot;
		this.config = bot.config.PRELOAD;

		bot.client.on('ready', this.onReady.bind(this));
	}

	onReady() {
		this.config.GUILDS.forEach(this.preloadUsers.bind(this));
	}

	preloadUsers(guildId) {
		const guild = this.bot.client.guilds.get(guildId);
		if (!guild) return;

		// TODO: for Discord.js move to guild.members.fetch()
		guild.fetchMembers();
	}
}

module.exports = RemindersPlugin;
