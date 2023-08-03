const { SnowflakeUtil } = require('discord.js');
const Cache = require('../../../structs/Cache.js');
const Filter = require('../structs/Filter.js');

// This Filter is placed here due to structuring reasons,
// but it's not a real "message filter" that the automod plugin deals with
// It's not interested in messages and instead manually handles guild joins
// and locks down a server if too many happen in too short of a time
class LockdownFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.config = automod.config.LOCKDOWN || {};
        this.joins = this.config.JOINS || 10;
        this.delay = this.config.DELAY || 15 * 60 * 1000;
        this.roleId = this.config.MUTE_ROLE_ID || '401231955741507604';
        this.channelId = this.config.CHANNEL || '246075715714416641';
        this.lockdownMessage = this.config.MESSAGE || '⚠️ Entering server lockdown';

        this.guildMap = new Cache();

        this.lockdownGuilds = new Map();

        automod.bot.listen('guildMemberAdd', this.onJoin, this);
    }

    interested(message) {
        return false;
    }

    handle() {}

    onJoin(member) {
        if (!member.guild) return;

        if (this.lockdownGuilds.has(member.guild.id)) {
            this.customHandle(member);
            return;
        }

        let set = this.guildMap.get(member.guild.id, () => new Set());

        set.add(member.user.id);

        setTimeout(() => {
            set.delete(member.user.id);
        }, this.delay);

        if (set.size > this.joins) {
            this.lockdown(member.guild).catch(this.automod.bot.reportError.bind(this.automod.bot, 'Error in lockdown... oh no'));
        }
    }

    async lockdown(guild, maxAge = 0) {
        this.lockdownGuilds.set(guild.id, maxAge);

        const channel = guild.channels.cache.get(this.channelId);

        const promises = [];

        if (channel) {
            promises.push(channel.send(this.lockdownMessage));
        }

        for (const id of this.guildMap.get(guild.id)) {
            const member = guild.members.cache.get(id);

            if (member) {
                promises.push(this.customHandle(member));
            }
        }

        await Promise.all(promises);
    }

    async customHandle(member) {
        const maxAge = this.lockdownGuilds.get(member.guild.id);
        const age = SnowflakeUtil.deconstruct(member.user.id).date;

        // If the account age is less than today - maxage, it's too old
        if (maxAge > 0 && age.getTime() < Date.now() - maxAge * 1000 * 60 * 60 * 24) return;

        const muteAction = member.roles.add(this.roleId);
        const muteResult = await muteAction.then(() => 'and was muted', () => 'but could not be muted');

        let logMessage = `**Reason**: Lockdown\n<@${member.id}>`;

        // try {
        //     await message.author.send(`Hello. You were grounded for joining within a period considered a raid. Contact a server moderator if this was wrongful.`);
        // } catch (error) {
        //     if (error && error.code === 50007) {
        //         logMessage += '\nUser blocked DMs.';
        //     } else {
        //         await this.automod.bot.reportError('Failed to warn user:', error);
        //         logMessage += '\nFailed to warn user.';
        //     }
        // }

        const reporting = await this.automod.logchan();

        if (!reporting) return;

        await reporting.send({
            embeds: [{
                author: {
                    name: `${member.user.tag} has joined during a lockdown ${muteResult}`,
                    icon_url: member.user.displayAvatarURL()
                },
                color: member.guild.me.displayColor,
                description: logMessage,
            }]
        });
    }
}

module.exports = LockdownFilter;
