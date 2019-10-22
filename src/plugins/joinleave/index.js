const Plugin = require('../../structs/Plugin.js');

class JoinLeavePlugin extends Plugin {
    load() {
        this.bot.joinleave = new JoinLeave(this.bot);
    }
}

class JoinLeave {
    constructor(bot) {
        return;
        bot.client.on('guildMemberAdd', this.onJoin.bind(this));
        bot.client.on('guildMemberRemove', this.onLeave.bind(this));
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

module.exports = JoinLeavePlugin;