import { SnowflakeUtil, Message, Guild, GuildMember, TextChannel } from 'discord.js';
import * as t from 'io-ts';

import AutomodPlugin from '..';
import Cache from '../../../structs/Cache';
import AutomodFilter from '../structs/AutomodFilter';
import { ConfigProvider } from '../../../structs/Config';

const LockdownConfigSchema = t.type({
    LOCKDOWN: t.type({
        JOINS: t.number,
        DELAY: t.number,
        MUTE_ROLE_ID: t.string,
        CHANNEL: t.string,
        MESSAGE: t.string
    })
});

// This Filter is placed here due to structuring reasons,
// but it's not a real "message filter" that the automod plugin deals with
// It's not interested in messages and instead manually handles guild joins
// and locks down a server if too many happen in too short of a time
export default class LockdownFilter extends AutomodFilter {
    private config: t.TypeOf<typeof LockdownConfigSchema>['LOCKDOWN'];
    private guildMap: Cache<string, Set<string>>;
    private lockdownGuilds: Map<string, number>;

    constructor(automod: AutomodPlugin, config: ConfigProvider) {
        super(automod, config);

        this.config = config.getOptionTyped('AUTOMOD', LockdownConfigSchema).LOCKDOWN;
        // this.joins = this.config.JOINS || 10;
        // this.delay = this.config.DELAY || 15 * 60 * 1000;
        // this.roleId = this.config.MUTE_ROLE_ID || '401231955741507604';
        // this.channelId = this.config.CHANNEL || '246075715714416641';
        // this.lockdownMessage = this.config.MESSAGE || '⚠️ Entering server lockdown';

        this.guildMap = new Cache();

        this.lockdownGuilds = new Map();

        automod.getBot().listen('guildMemberAdd', this.onJoin, this);
    }

    interested(message: Message) {
        return false;
    }

    handle() {}

    onJoin(member: GuildMember) {
        if (!member.guild) return;

        if (this.lockdownGuilds.has(member.guild.id)) {
            this.customHandle(member);
            return;
        }

        let set = this.guildMap.get(member.guild.id, () => new Set());

        set.add(member.user.id);

        setTimeout(() => {
            set.delete(member.user.id);
        }, this.config.DELAY);

        if (set.size > this.config.JOINS) {
            this.lockdown(member.guild).catch(this.automod.getBot().reportError.bind(this.automod.getBot(), 'Error in lockdown... oh no'));
        }
    }

    async lockdown(guild: Guild, maxAge = 0) {
        this.lockdownGuilds.set(guild.id, maxAge);

        const channel = guild.channels.cache.get(this.config.CHANNEL);

        const promises = [];

        if (channel && channel instanceof TextChannel) {
            promises.push(channel.send(this.config.MESSAGE));
        }

        for (const id of this.guildMap.get(guild.id)) {
            const member = guild.members.cache.get(id);

            if (member) {
                promises.push(this.customHandle(member));
            }
        }

        await Promise.all(promises);
    }

    isGuildLockedDown(guildId: string) {
        return this.lockdownGuilds.has(guildId);
    }

    lockdownGuild(guildId: string, maxAge: number) {
        this.lockdownGuilds.set(guildId, maxAge);
    }

    releaseGuild(guildId: string) {
        this.lockdownGuilds.delete(guildId);
    }

    async customHandle(member: GuildMember) {
        const maxAge = this.lockdownGuilds.get(member.guild.id);
        const age = SnowflakeUtil.deconstruct(member.user.id).date;

        // If the account age is less than today - maxage, it's too old
        if (maxAge && maxAge > 0 && age.getTime() < Date.now() - maxAge * 1000 * 60 * 60 * 24) return;

        const muteAction = member.roles.add(this.config.MUTE_ROLE_ID);
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

        if (!reporting || !(reporting instanceof TextChannel)) return;

        await reporting.send({
            embeds: [{
                author: {
                    name: `${member.user.tag} has joined during a lockdown ${muteResult}`,
                    icon_url: member.user.displayAvatarURL()
                },
                color: member.guild.me?.displayColor,
                description: logMessage,
            }]
        });
    }
}
