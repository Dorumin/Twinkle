import { MessageEmbed, MessageAttachment, SnowflakeUtil, Emoji, GuildEmoji, TextChannel, Guild, Message, VoiceState, GuildMember, Role, Collection, Presence } from 'discord.js';
import * as t from 'io-ts';

import Twinkle from '$src/Twinkle';
import Plugin from '$src/structs/Plugin';
import FormatterPlugin from '../fmt';
import { ConfigProvider } from '$src/structs/Config';

const LogTypeSchema = t.union([
    t.literal('VOICE_JOIN'),
    t.literal('VOICE_LEAVE'),
    t.literal('STREAM_START'),
    t.literal('STREAM_END'),

    t.literal('MESSAGE_DELETE'),
    t.literal('MESSAGE_UPDATE'),

    t.literal('ROLES_UPDATE'),
    t.literal('EMOJI_CREATE'),

    t.literal('NICKNAME_CHANGE'),
    t.literal('USERNAME_CHANGE'),
    t.literal('STATUS_CHANGE'),

    t.literal('GUILD_ICON_CHANGE'),
    t.literal('GUILD_NAME_CHANGE'),
]);

const GuildLoggerConfigSchema = t.type({
    GUILDS: t.record(t.string, t.type({
        CHANNELS: t.record(t.string, t.type({
            LOG_TYPES: t.array(LogTypeSchema)
        }))
    }))
});

type ListenerMap = Record<t.TypeOf<typeof LogTypeSchema>, { guildId: string, channelId: string }[]>;

export default class GuildLoggerPlugin extends Plugin {
    private config: t.TypeOf<typeof GuildLoggerConfigSchema>;
    private fmt: FormatterPlugin;
    private listeners: ListenerMap;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.config = config.getOptionTyped('GUILD_LOGGER', GuildLoggerConfigSchema);

        this.fmt = bot.loadPlugin(FormatterPlugin);
        this.listeners = {} as ListenerMap;

        this.collectEvents();
    }

    async load() {
        this.bot.listen('ready', this.onReady, this);
    }

    collectEvents() {
        this.listeners = {} as ListenerMap;

        for (const guildId in this.config.GUILDS) {
            const guild = this.config.GUILDS[guildId];

            for (const channelId in guild.CHANNELS) {
                const channel = guild.CHANNELS[channelId];

                for (const logType of channel.LOG_TYPES) {
                    if (!(logType in this.listeners)) {
                        this.listeners[logType] = [];
                    }

                    this.listeners[logType].push({
                        guildId,
                        channelId
                    });
                }
            }
        }
    }

    getLogChannel(guild: Guild, channelId: string) {
        const channel = guild.channels.cache.get(channelId);

        if (channel instanceof TextChannel) {
            return channel
        } else {
            return null;
        }
    }

    onReady() {
        if (this.bot.dev) return;

        this.bot.listen('emojiCreate', this.onEmojiCreate, this);
        this.bot.listen('guildUpdate', this.onGuildUpdate, this);
        this.bot.listen('messageUpdate', this.onMessageUpdate, this);
        this.bot.listen('messageDelete', this.onMessageDelete, this);
        this.bot.listen('voiceStateUpdate', this.onVoiceStateUpdate, this);
        this.bot.listen('guildMemberUpdate', this.onGuildMemberUpdate, this);
        this.bot.listen('presenceUpdate', this.onPresenceUpdate, this);
    }

    async onEmojiCreate(emoji: GuildEmoji) {
        if (!this.listeners.EMOJI_CREATE) return;
        if (!emoji.guild) return;

        for (const listener of this.listeners.EMOJI_CREATE) {
            if (listener.guildId !== emoji.guild.id) continue;

            const channel = this.getLogChannel(emoji.guild, listener.channelId);
            if (!channel) continue;

            let author = emoji.author;
            if (!author) {
                try {
                    author = await emoji.fetchAuthor();
                } catch(e) {}
            }

            let description;
            if (author) {
                description = `<@${author.id}> has created the emoji ${emoji}`;
            } else {
                description = `The ${emoji} emoji was created`;
            }

            await channel.send({
                embeds: [
                    new MessageEmbed()
                        .setDescription(description)
                        .setImage(emoji.url)
                        .setFooter('Emoji create')
                        .setTimestamp()
                ]
            });
        }
    }

    onGuildUpdate(oldGuild: Guild, newGuild: Guild) {
        const changedIcon = oldGuild.icon !== newGuild.icon;
        const changedName = oldGuild.name !== newGuild.name;

        if (changedIcon) {
            this.onGuildIconChange(oldGuild, newGuild);
        }

        if (changedName) {
            this.onGuildNameChange(oldGuild, newGuild);
        }
    }

    async onGuildIconChange(oldGuild: Guild, newGuild: Guild) {
        if (!this.listeners.GUILD_ICON_CHANGE) return;

        for (const listener of this.listeners.GUILD_ICON_CHANGE) {
            if (listener.guildId !== newGuild.id) continue;

            const channel = this.getLogChannel(newGuild, listener.channelId);
            if (!channel) continue;

            await channel.send({
                // This embed has duplicate thumbnail and footer icon
                // I believe footer icons are so smol they're saved forever,
                // while thumbnails are cached in the media proxy for a bit
                // Eventually the old server icon would be deleted,
                // and it will live on in the footer
                // The new icon is uploaded directly
                embeds: [
                    new MessageEmbed()
                        .setDescription('The guild icon was changed')
                        .setImage(
                            oldGuild.iconURL({
                                format: 'png',
                                dynamic: true,
                                size: 2048
                            }) ?? ''
                        )
                        .setFooter('Guild icon change',
                            oldGuild.iconURL({
                                format: 'png',
                                dynamic: true,
                                size: 2048
                            }) ?? ''
                        )
                        .setTimestamp()
                ]
            });

            const newIconAnim = newGuild.icon?.startsWith('a_');

            await channel.send({
                content: 'New icon:',
                files: [
                    new MessageAttachment(
                        newGuild.iconURL({
                            format: 'png',
                            dynamic: true,
                            size: 2048
                        }) ?? '',
                        `icon.${newIconAnim ? 'gif' : 'png'}`
                    )
                ]
            });
        }
    }

    async onGuildNameChange(oldGuild: Guild, newGuild: Guild) {
        if (!this.listeners.GUILD_NAME_CHANGE) return;

        for (const listener of this.listeners.GUILD_NAME_CHANGE) {
            if (listener.guildId !== newGuild.id) continue;

            const channel = this.getLogChannel(newGuild, listener.channelId);
            if (!channel) continue;

            await channel.send({
                embeds: [
                    new MessageEmbed()
                        .setTitle(`Guild name was updated`)
                        .addField('Old name', oldGuild.name, true)
                        .addField('New name', newGuild.name, true)
                        .setFooter('Guild name change',
                            newGuild.iconURL({
                                format: 'png',
                                dynamic: true,
                                size: 32
                            }) ?? ''
                        )
                        .setTimestamp()
                ]
            });
        }
    }

    async onMessageUpdate(oldMessage: Message, newMessage: Message) {
        if (!this.listeners.MESSAGE_UPDATE) return;
        if (!newMessage.guild) return;
        if (oldMessage.content === newMessage.content) return;

        for (const listener of this.listeners.MESSAGE_UPDATE) {
            if (listener.guildId !== newMessage.guild.id) continue;

            const channel = this.getLogChannel(newMessage.guild, listener.channelId);
            if (!channel) continue;

            let description = `<@${newMessage.author.id}> edited a message in <#${newMessage.channel.id}>`;

            if (oldMessage.content) {
                description += `\n\nContent was:\n${oldMessage.content}`;

                // Not that necessary
                // It's not that necessary but I want it
                const extra = '\n\nNow it\'s:\n' + newMessage.content;

                if ((description + extra).length <= 2048) {
                    description += extra;
                }
            }

            await channel.send({
                embeds: [
                    new MessageEmbed()
                        .setTitle('Message link')
                        .setURL(newMessage.url)
                        .setDescription(description)
                        .setFooter('Message edit', newMessage.author.avatarURL() ?? '')
                        .setTimestamp()
                ]
            });
        }
    }

    async onMessageDelete(message: Message) {
        if (!this.listeners.MESSAGE_DELETE) return;
        if (!message.guild) return;

        for (const listener of this.listeners.MESSAGE_DELETE) {
            if (listener.guildId !== message.guild.id) continue;

            const channel = this.getLogChannel(message.guild, listener.channelId);
            if (!channel) continue;

            let description = `A message by <@${message.author.id}> ` +
                `was deleted in <#${message.channel.id}>`;

            try {
                // Attempt to find out the user who deleted the message
                const auditLogs = await message.guild.fetchAuditLogs({
                    limit: 1
                });
                const latest = auditLogs.entries.first()!;
                const elapsed = Date.now() - SnowflakeUtil.deconstruct(latest.id).timestamp;

                if (
                    // @ts-expect-error Audit log discord.js typings are whack
                    latest.action === 'MESSAGE_DELETE' &&
                    latest.target?.id === message.author.id &&
                    (latest.extra as any).channel.id === message.channel.id &&
                    elapsed < 2000
                ) {
                    description = `A message by <@${message.author.id}> ` +
                        `was deleted in <#${message.channel.id}> ` +
                        `by <@${latest.executor?.id}>`;
                }
            } catch(e) {}

            if (message.content) {
                description += `\n\n`;

                if (message.reference) {
                    const { guildId, channelId, messageId } = message.reference;

                    description += this.fmt.link(
                        'Reply to',
                        `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
                    ) + '\n';
                }

                description += message.content;
            }

            await channel.send({
                embeds: [
                    new MessageEmbed()
                        .setTitle('Message link')
                        .setURL(message.url)
                        .setDescription(description)
                        .setFooter('Message delete', message.author.avatarURL() ?? '')
                        .setTimestamp()
                ]
            });

            for (const attachment of message.attachments.values()) {
                await channel.send({
                    files: [
                        attachment
                    ]
                });
            }
        }
    }

    onVoiceStateUpdate(prevState: VoiceState, curState: VoiceState) {
        // If channelId was null or undefined, user wasn't/isn't in VC
        const hasJoined = prevState.channelId == undefined;
        const hasLeft = curState.channelId == undefined;

        const startedStreaming = !prevState.streaming && curState.streaming;
        const stoppedStreaming = prevState.streaming && !curState.streaming;

        const { guild, id: userId, channelId } = prevState;

        if (channelId === null) return;

        if (hasJoined) {
            this.onUserJoinVoice({ guild, userId, channelId });
            return;
        }

        if (hasLeft) {
            this.onUserLeaveVoice({ guild, userId, channelId });
            return;
        }

        if (startedStreaming) {
            this.onUserStartStreaming({ guild, userId, channelId });
            return;
        }

        if (stoppedStreaming) {
            this.onUserStopStreaming({ guild, userId, channelId });
            return;
        }
    }

    async onUserJoinVoice({ guild, userId, channelId }: { guild: Guild, userId: string, channelId: string }) {
        if (!this.listeners.VOICE_JOIN) return;

        for (const listener of this.listeners.VOICE_JOIN) {
            if (listener.guildId !== guild.id) continue;

            const channel = this.getLogChannel(guild, listener.channelId);
            const voiceChannel = guild.channels.cache.get(channelId);
            const member = guild.members.cache.get(userId);

            if (channel && voiceChannel && member) {
                await channel.send({
                    embeds: [
                        new MessageEmbed()
                            .setDescription(`<@${userId}> joined the voice channel ${this.fmt.bold(voiceChannel.name)}`)
                            .setFooter('Voice join', member.user.avatarURL() ?? '')
                            .setTimestamp()
                    ]
                });
            } else {
                console.log('Missing a cache entry in log event');
                console.log(channel);
                console.log(voiceChannel);
                console.log(member);
            }
        }
    }

    async onUserLeaveVoice({ guild, userId, channelId }: { guild: Guild, userId: string, channelId: string }) {
        if (!this.listeners.VOICE_LEAVE) return;

        for (const listener of this.listeners.VOICE_LEAVE) {
            if (listener.guildId !== guild.id) continue;

            const channel = this.getLogChannel(guild, listener.channelId);
            const voiceChannel = guild.channels.cache.get(channelId);
            const member = guild.members.cache.get(userId);

            if (channel && voiceChannel && member) {
                await channel.send({
                    embeds: [
                        new MessageEmbed()
                            .setDescription(`<@${userId}> left the voice channel ${this.fmt.bold(voiceChannel.name)}`)
                            .setFooter('Voice leave', member.user.avatarURL() ?? '')
                            .setTimestamp()
                    ]
                });
            } else {
                console.log('Missing a cache entry in log event');
                console.log(channel);
                console.log(voiceChannel);
                console.log(member);
            }
        }
    }

    async onUserStartStreaming({ guild, userId, channelId }: { guild: Guild, userId: string, channelId: string }) {
        if (!this.listeners.STREAM_START) return;

        for (const listener of this.listeners.STREAM_START) {
            if (listener.guildId !== guild.id) continue;

            const channel = this.getLogChannel(guild, listener.channelId);
            const voiceChannel = guild.channels.cache.get(channelId);
            const member = guild.members.cache.get(userId);

            if (channel && voiceChannel && member) {
                await channel.send({
                    embeds: [
                        new MessageEmbed()
                            .setDescription(`<@${userId}> started streaming in ${this.fmt.bold(voiceChannel.name)}`)
                            .setFooter('Stream start', member.user.avatarURL() ?? '')
                            .setTimestamp()
                    ]
                });
            } else {
                console.log('Missing a cache entry in log event');
                console.log(channel);
                console.log(voiceChannel);
                console.log(member);
            }
        }
    }

    async onUserStopStreaming({ guild, userId, channelId }: { guild: Guild, userId: string, channelId: string }) {
        if (!this.listeners.STREAM_END) return;

        for (const listener of this.listeners.STREAM_END) {
            if (listener.guildId !== guild.id) continue;

            const channel = this.getLogChannel(guild, listener.channelId);
            const voiceChannel = guild.channels.cache.get(channelId);
            const member = guild.members.cache.get(userId);

            if (channel && voiceChannel && member) {
                await channel.send({
                    embeds: [
                        new MessageEmbed()
                            .setDescription(`<@${userId}> stopped streaming in ${this.fmt.bold(voiceChannel.name)}`)
                            .setFooter('Stream end', member.user.avatarURL() ?? '')
                            .setTimestamp()
                    ]
                });
            } else {
                console.log('Missing a cache entry in log event');
                console.log(channel);
                console.log(voiceChannel);
                console.log(member);
            }
        }
    }

    onGuildMemberUpdate(oldMember: GuildMember, newMember: GuildMember) {
        const nicknameChanged = oldMember.nickname !== newMember.nickname;
        const usernameChanged = oldMember.user.tag !== newMember.user.tag;
        const updatedRoles = oldMember.roles.cache.difference(newMember.roles.cache);

        // TODO: Pending attribution on these two with the audit log
        if (nicknameChanged) {
            this.onNicknameChange(oldMember, newMember);
        }

        if (usernameChanged) {
            this.onUsernameChange(oldMember, newMember);
        }

        if (updatedRoles.size !== 0) {
            this.onRolesUpdate(newMember, updatedRoles);
        }
    }

    async onNicknameChange(oldMember: GuildMember, newMember: GuildMember) {
        if (!this.listeners.NICKNAME_CHANGE) return;

        for (const listener of this.listeners.NICKNAME_CHANGE) {
            if (listener.guildId !== newMember.guild.id) continue;

            const channel = this.getLogChannel(newMember.guild, listener.channelId);
            if (!channel) continue;

            let description = `<@${newMember.user.id}>'s nickname was changed`;
            try {
                // Try to find out who updated the nickname
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    limit: 1
                });
                const latest = auditLogs.entries.first()!;
                const elapsed = Date.now() - latest.createdTimestamp;

                if (
                    // @ts-expect-error discord.js audit log typings are whack
                    latest.action === 'MEMBER_UPDATE' &&
                    latest.target?.id === newMember.user.id &&
                    latest.changes.some(change => change.key === 'nick') &&
                    elapsed < 2000
                ) {
                    description = `<@${newMember.user.id}>'s nickname was updated `
                        + `by <@${latest.executor?.id}>`;
                }
            } catch(e) {}

            await channel.send({
                embeds: [
                    new MessageEmbed()
                        .setDescription(description)
                        .addField('Old nickname', oldMember.nickname || '*<none>*', true)
                        .addField('New nickname', newMember.nickname || '*<none>*', true)
                        .setFooter('Nickname change',
                            newMember.user.avatarURL({
                                format: 'png',
                                dynamic: true,
                                size: 32
                            }) ?? ''
                        )
                        .setTimestamp()
                ]
            });
        }
    }

    async onUsernameChange(oldMember: GuildMember, newMember: GuildMember) {
        if (!this.listeners.USERNAME_CHANGE) return;

        for (const listener of this.listeners.USERNAME_CHANGE) {
            if (listener.guildId !== newMember.guild.id) continue;

            const channel = this.getLogChannel(newMember.guild, listener.channelId);
            if (!channel) continue;

            await channel.send({
                embeds: [
                    new MessageEmbed()
                        .setDescription(`<@${newMember.user.id}>'s username was changed`)
                        .addField('Old username', oldMember.user.tag, true)
                        .addField('New username', newMember.user.tag, true)
                        .setFooter('Username change',
                            newMember.user.avatarURL({
                                format: 'png',
                                dynamic: true,
                                size: 32
                            }) ?? ''
                        )
                        .setTimestamp()
                ]
            });
        }
    }

    async onRolesUpdate(member: GuildMember, updatedRoles: Collection<string, Role>) {
        if (!this.listeners.ROLES_UPDATE) return;

        for (const listener of this.listeners.ROLES_UPDATE) {
            if (listener.guildId !== member.guild.id) continue;

            const channel = this.getLogChannel(member.guild, listener.channelId);
            if (!channel) continue;

            let description = `<@${member.user.id}>'s roles were updated`;
            try {
                // Try to find out who updated the roles
                const auditLogs = await member.guild.fetchAuditLogs({
                    limit: 1
                });
                const latest = auditLogs.entries.first()!;
                const elapsed = Date.now() - SnowflakeUtil.deconstruct(latest.id).timestamp;

                if (
                    // @ts-expect-error discord.js audit log typings are still whack
                    latest.action === 'MEMBER_ROLE_UPDATE' &&
                    latest.target?.id === member.user.id &&
                    elapsed < 2000
                ) {
                    description = `<@${member.user.id}>'s roles were updated `
                        + `by <@${latest.executor?.id}>`;
                }
            } catch(e) {}

            const embed = new MessageEmbed()
                .setDescription(description)
                .setFooter('Roles update',
                    member.user.avatarURL({
                        format: 'png',
                        dynamic: true,
                        size: 32
                    }) ?? ''
                )
                .setTimestamp();

            const added = updatedRoles.filter(role => member.roles.cache.has(role.id));
            const removed = updatedRoles.filter(role => !member.roles.cache.has(role.id));

            if (added.size !== 0) {
                embed.addField('Added roles', added.map(role => `<@&${role.id}>`).join('\n'));
            }

            if (removed.size !== 0) {
                embed.addField('Removed roles', removed.map(role => `<@&${role.id}>`).join('\n'));
            }

            await channel.send({
                embeds: [ embed ]
            });
        }
    }

    onPresenceUpdate(oldPresence: Presence, newPresence: Presence) {
        if (newPresence.status === 'offline') return;
        if (newPresence.user?.bot) return;

        const oldStatus = this.getPresenceStatus(oldPresence);
        const newStatus = this.getPresenceStatus(newPresence);
        const statusChanged = oldStatus !== newStatus;

        if (oldStatus !== null && newStatus !== null && statusChanged) {
            this.onStatusChange(newPresence, oldStatus, newStatus);
        }
    }

    getPresenceStatus(presence: Presence) {
        const status = presence?.activities.find(activity =>
            activity.name === 'Custom Status' &&
            activity.type === 'CUSTOM'
        );

        return status?.state ?? null;
    }

    async onStatusChange(newPresence: Presence, oldStatus: string, newStatus: string) {
        if (!this.listeners.STATUS_CHANGE) return;

        const newMember = newPresence.member;

        if (!newMember) return;

        for (const listener of this.listeners.STATUS_CHANGE) {
            if (listener.guildId !== newMember.guild.id) continue;

            const channel = this.getLogChannel(newMember. guild, listener.channelId);
            if (!channel) continue;

            await channel.send({
                embeds: [
                    new MessageEmbed()
                        .setDescription(`<@${newMember.user.id}>'s status was changed`)
                        .addField('Old status', oldStatus ?? '*<none>*', true)
                        .addField('New status', newStatus ?? '*<none>*', true)
                        .setFooter('Status change',
                            newMember.user.avatarURL({
                                format: 'png',
                                dynamic: true,
                                size: 32
                            }) ?? ''
                        )
                        .setTimestamp()
                ]
            });
        }
    }
}
