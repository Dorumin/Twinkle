const Plugin = require('../../structs/Plugin.js');

class JoinLeavePlugin extends Plugin {
    load() {
        this.bot.joinleave = new JoinLeave(this.bot);
    }
}

class JoinLeave {
    constructor(bot) {
        this.config = bot.config.JOIN_LEAVE;

        bot.client.on('guildMemberAdd', this.onJoin.bind(this));
        bot.client.on('guildMemberRemove', this.onLeave.bind(this));
    }

    // getDefaultChannel(guild) {
    //     if (guild.channels.has(guild.id)) {
    //         return guild.channels.get(guild.id);
    //     }

    //     return guild.channels.sort((a, b) => a.id - b.id).first();
    // }

    getChannel(guild) {
        return guild.channels.fetch(this.config.CHANNEL);
    }

    getVars(member) {
        return {
            USERID: member.user.id,
            USERNAME: member.user.username,
            USERDISCRIM: member.user.discriminator
        }
    }

    formatMessage(message, member) {
        const vars = this.getVars(member);
        return message.replace(/\$([A-Z]+)/g, (full, name) => {
            if (vars[name]) {
                return vars[name];
            }

            return full;
        });
    }

    async onJoin(member) {
        const channel = await this.getChannel(member.guild);
        if (!channel) return;

        channel.send(this.formatMessage(this.config.JOIN_MESSAGE, member));
    }

    async onLeave(member) {
        const channel = await this.getChannel(member.guild);
        if (!channel) return;

        channel.send(this.formatMessage(this.config.LEAVE_MESSAGE, member));
    }
}

module.exports = JoinLeavePlugin;
