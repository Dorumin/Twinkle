const Plugin = require('../../structs/plugin.js');

class DatabasePlugin extends Plugin {
    load() {
        this.bot.db = new Database(this.bot);
    }
}

class Database {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.DB;
        this.type = config.TYPE;
        this.transport = null;

        switch (this.type) {
            case 'dropbox':
                this.transport = new DropboxTransport();
            case 'fs':
                this.transport = new FSTransport();
            default:
                throw new Error(`Unsupported transport: ${this.type}`);
        }
    }

    getDefaultChannel(guild) {
        if (guild.channels.has(guild.id)) {
            return guild.channels.get(guild.id);
        }

        return guild.channels.sort((a, b) => a.id - b.id).first();
    }
    
    onJoin(member) {
        const channel = this.getDefaultChannel(member.guild);
        channel.send(`Hello <@${member.id}> and welcome to the Fandom Developers server! You can read useful information about the server in <#246663167537709058>`);
    }

    onLeave(member) {
        const channel = this.getDefaultChannel(member.guild);
        channel.send(`client.emit(Events.GUILD_LEAVE, "${member.user.username}#${member.user.discriminator}");`);
    }
}

module.exports = DatabasePlugin;