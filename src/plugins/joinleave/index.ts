import * as t from 'io-ts';

import Twinkle from '$src/Twinkle';
import Plugin from '../../structs/Plugin';
import { ConfigProvider } from '$src/structs/Config';
import { Collection, Guild, GuildMember, Invite, Message, TextChannel } from 'discord.js';

const JoinLeaveConfigSchema = t.type({
    CHANNEL: t.string,
    JOIN_MESSAGE: t.string,
    LEAVE_MESSAGE: t.string,
    SPECIAL_JOIN_CODES: t.record(t.string, t.string)
});

type CachedInvite = { code: string, uses: number };
type CachedInvites = Record<string, CachedInvite>;

export default class JoinLeavePlugin extends Plugin {
    private config: t.TypeOf<typeof JoinLeaveConfigSchema>;
    private cache: Map<string, CachedInvites>;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.config = config.getOptionTyped('JOIN_LEAVE', JoinLeaveConfigSchema);

        this.cache = new Map();

        bot.listen('ready', this.populateCache, this);
        bot.listen('guildMemberAdd', this.onJoin, this);
        bot.listen('guildMemberRemove', this.onLeave, this);
    }

    serialize(inviteCollection: Collection<string, Invite>) {
        const object: CachedInvites = {};

        for (const invite of inviteCollection.values()) {
            const { code, uses } = invite;

            object[invite.code] = {
                code,
                uses: uses ?? 0
            };
        }

        return object;
    }

    async populateCache() {
        for (const guild of this.bot.client.guilds.cache.values()) {
            try {
                const invites = await guild.invites.fetch();
                this.cache.set(guild.id, this.serialize(invites));
            } catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 50013) {
                    await this.bot.reportError('Missing permissions (MANAGE_SERVER) for fetching invites.', error);
                } else {
                    await this.bot.reportError('Error while populating cache:', error);
                }
            }
        }

        // Don't blow your own stack, even if you're flexible enough to do so
        setTimeout(this.populateCache.bind(this), 1000 * 60 * 60);
    }

    // Compares two invite collections and filters out the two who have changed
    // If one is in old and missing in cur it's not counted even though it could've been a one-use invite
    diffInvites(old: CachedInvites, cur: CachedInvites) {
        const diffed = [];

        for (const code in old) {
            const oldInvite = old[code];
            const curInvite = cur[code];

            // Invite died between last cache; maybe it expired from usage or was deleted? Ignore it
            if (!curInvite) continue;

            if (curInvite.uses > oldInvite.uses) {
                diffed.push(oldInvite);
            }
        }

        for (const code in cur) {
            const oldInvite = old[code];
            const curInvite = cur[code];

            // We never had it cached, ignore it
            if (!oldInvite) continue;

            if (curInvite.uses > oldInvite.uses) {
                const already = diffed.some(inv => inv.code === curInvite.code);

                if (!already) {
                    diffed.push(curInvite);
                }
            }
        }

        return diffed;
    }

    // Fetches the invite that was updated since the cache was used
    // Will return null when more than one invite has been updated, or the cache was empty
    async resolveInvite(guild: Guild) {
        const cached = this.cache.get(guild.id);
        if (!cached) return null;

        let current;
        try {
            current = this.serialize(await guild.invites.fetch());
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

    async getChannel(guild: Guild) {
        const channel = await guild.channels.fetch(this.config.CHANNEL);

        if (channel instanceof TextChannel) {
            return channel;
        } else {
            return null;
        }
    }

    getVars(member: GuildMember): Record<string, string> {
        return {
            USERID: member.user.id,
            USERNAME: member.user.username,
            USERDISCRIM: member.user.discriminator
        };
    }

    formatMessage(message: string, member: GuildMember) {
        const vars = this.getVars(member);

        return message.replace(/\$([A-Z]+)/g, (full, name) => {
            if (vars[name]) {
                return vars[name];
            }

            return full;
        });
    }

    async onJoin(member: GuildMember) {
        // Ignore in dev mode if outside of dev guild
        if (this.bot.onlyDev(member.guild)) return;

        const [channel, invite] = await Promise.all([
            this.getChannel(member.guild),
            this.resolveInvite(member.guild)
        ]);
        if (channel === null) return;

        let message = this.config.JOIN_MESSAGE;

        if (invite !== null && invite.code in this.config.SPECIAL_JOIN_CODES) {
            message = this.config.SPECIAL_JOIN_CODES[invite.code];
        }

        return channel.send(this.formatMessage(message, member));
    }

    async onLeave(member: GuildMember) {
        // Ignore in dev mode if outside of dev guild
        if (this.bot.onlyDev(member.guild)) return;

        const channel = await this.getChannel(member.guild);
        if (!channel) return;

        return channel.send(this.formatMessage(this.config.LEAVE_MESSAGE, member));
    }
}
