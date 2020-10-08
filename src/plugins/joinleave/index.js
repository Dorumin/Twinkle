const Plugin = require('../../structs/Plugin.js');
const Cache = require('../../structs/Cache.js');

class JoinLeavePlugin extends Plugin {
    load() {
        this.bot.joinleave = new JoinLeave(this.bot);
    }
}

class JoinLeave {
    constructor(bot) {
        this.bot = bot;
        this.dev = bot.config.ENV === 'development';
        this.config = bot.config.JOIN_LEAVE;
        this.specials = this.config.SPECIAL_JOIN_CODES;
        this.cache = new Map();

        bot.client.on('ready', this.populateCache.bind(this));
        bot.client.on('guildMemberAdd', this.onJoin.bind(this));
        bot.client.on('guildMemberRemove', this.onLeave.bind(this));
    }

    serialize(inviteCollection) {
        const object = {};

        for (const invite of inviteCollection.values()) {
            const { code, uses } = invite;

            object[invite.code] = {
                code,
                uses
            };
        }

        return object;
    }

    populateCache() {
        this.bot.client.guilds.cache.array().map(async guild => {
            try {
                const invites = await guild.fetchInvites();

                this.cache.set(guild.id, this.serialize(invites));
            } catch(e) {}
        });
    }

    // Compares two invite collections and filters out the two who have changed
    // If one is in old and missing in cur it's not counted even though it could've been a one-use invite
    diffInvites(old, cur) {
        const diffed = [];

        for (const code in old) {
            const oldInvite = old[code];
            const curInvite = cur[code];

            // Invite died between last cache; maybe it expired from usage or was deleted? Ignore it
            if (!curInvite) continue;

            if (oldInvite.uses <= curInvite.uses) continue;

            diffed.push(oldInvite);
        }

        for (const code in cur) {
            const oldInvite = old[code];
            const curInvite = cur[code];

            // We never had it cached, ignore it
            if (!oldInvite) continue;
            if (oldInvite.uses <= curInvite.uses) continue;

            // Since we're the 2nd pass, we should make sure they aren't repeated
            if (diffed.some(inv => inv.code === curInvite.code)) continue;

            diffed.push(curInvite);
        }

        return diffed;
    }

    // Fetches the invite that was updated since the cache was used
    // Will return null when more than one invite has been updated, or the cache was empty
    async resolveInvite(guild) {
        if (!this.cache.has(guild.id)) return null;

        const cached = this.cache.get(guild.id);
        let current;
        try {
            current = this.serialize(await guild.fetchInvites());
        } catch(e) {
            return null;
        }

        const diff = this.diffInvites(cached, current);

        this.cache.set(guild.id, current);

        if (diff.length !== 1) return null;

        return diff[0];
    }

    // getDefaultChannel(guild) {
    //     if (guild.channels.has(guild.id)) {
    //         return guild.channels.get(guild.id);
    //     }

    //     return guild.channels.sort((a, b) => a.id - b.id).first();
    // }

    getChannel(guild) {
        return guild.channels.cache.get(this.config.CHANNEL);
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

    async debug(member) {
        const channel = this.bot.client.channels.cache.get('476452336282107925');
        const old = this.cache.get(member.guild.id);
        const cur = this.serialize(await member.guild.fetchInvites());

        channel.send(`User joined: ${member.id}`);
        channel.send('Cached invites' + this.bot.fmt.codeBlock('json', JSON.stringify(cur, null, 4)));
        channel.send('Current invites' + this.bot.fmt.codeBlock('json', JSON.stringify(old, null, 4)));
    }

    async onJoin(member) {
        if (this.dev && this.bot.config.DEV.GUILD !== member.guild.id) return;

        this.debug(member);

        const [channel, invite] = await Promise.all([
            this.getChannel(member.guild),
            this.resolveInvite(member.guild)
        ]);
        if (!channel) return;

        let message = this.config.JOIN_MESSAGE;

        if (invite !== null && this.specials.hasOwnProperty(invite.code)) {
            message = this.specials[invite.code];
        }

        channel.send(this.formatMessage(message, member));
    }

    async onLeave(member) {
        if (this.dev && this.bot.config.DEV.GUILD !== member.guild.id) return;

        const channel = await this.getChannel(member.guild);
        if (!channel) return;

        channel.send(this.formatMessage(this.config.LEAVE_MESSAGE, member));
    }
}

module.exports = JoinLeavePlugin;
