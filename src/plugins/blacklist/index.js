const Plugin = require('../../structs/Plugin.js');

class BlacklistPlugin extends Plugin {
	load() {
		this.bot.blacklist = new Blacklist(this.bot);
	}
}

class Blacklist {
	constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'config', { value: bot.config.blacklist || {} });

        this.userIds = this.config.USERS || [];
	}

    isBlacklisted(member) {
        return this.isBlacklistedUser(member.user);
    }

    isBlacklistedUser(user) {
        return this.userIds.includes(user.id);
    }
}

module.exports = BlacklistPlugin;
