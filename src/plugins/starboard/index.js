const { MessageEmbed } = require('discord.js');
const Plugin = require('../../structs/Plugin.js');
const SQLPlugin = require('../sql');

const MANAGE_MESSAGES = 'MANAGE_MESSAGES';
const STAR = '⭐';

const STAR_LEVELS = [
    {
        minimum: 20,
        emoji: '✨'
    },
    {
        minimum: 14,
        emoji: '💫'
    },
    {
        minimum: 8,
        emoji: '🌟'
    },
    {
        minimum: 1,
        emoji: '⭐'
    }
];

class StarboardPlugin extends Plugin {
    static get deps() {
        return [
            SQLPlugin
        ];
    }

    load() {
        this.bot.starboard = new Starboard(this.bot);
    }
}

class Starboard {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'config', { value: bot.config.STARBOARD });

        this.threshold = this.config.THRESHOLD;
        this.starboardId = this.config.STARBOARD_ID;

        this.sql = this.bot.sql.handle('starboard');
        this.sql.exec(`CREATE TABLE IF NOT EXISTS starboard_starred_v1 (
            message_id INTEGER PRIMARY KEY,
            channel_id INTEGER NOT NULL,
            guild_id INTEGER,
            star_id INTEGER,
            last_updated INTEGER,
            last_checked INTEGER
        )`);

        this.sql.getStarred = this.sql.prepare(`
            SELECT *
            FROM starboard_starred_v1
            WHERE
                message_id = ?
        `).safeIntegers(true);
        this.sql.setStarred = this.sql.prepare(`
            REPLACE INTO starboard_starred_v1 (
                message_id,
                channel_id,
                guild_id,
                star_id,
                last_updated,
                last_checked
            )
            VALUES (
                $messageId,
                $channelId,
                $guildId,
                $starId,
                $lastUpdated,
                $lastChecked
            )
        `).safeIntegers(true);

        bot.listenPartial('messageReactionAdd', this.onReaction, this);
        bot.listenPartial('messageReactionRemove', this.onReaction, this);
    }

    async onReaction(reaction, user) {
        // Ignore bots and self
        if (
            user.bot ||
            reaction.emoji.name !== STAR ||
            user.id == this.bot.client.user.id
        ) return;

        const message = reaction.message;

        if (message.partial) {
            await message.fetch();
        }

        const guild = message.guild;

        if (!guild) return;

        // Ignore in dev mode if outside of dev guild
        if (this.bot.onlyDev(guild)) return;

        const member = await guild.members.fetch(user.id);
        const isMod = member.permissions.has(MANAGE_MESSAGES);

        if (!isMod && reaction.count < this.threshold) return;

        const starEntry = await this.sql.getStarred.get(message.id);
        if (starEntry) {
            await this.updateStar(message, reaction, starEntry);
        } else {
            await this.star(message, reaction);
        }
    }

    async star(message, reaction) {
        const starboard = message.guild.channels.cache.get(this.starboardId);
        if (!starboard) return;

        await this.sql.setStarred.run({
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            starId: null,
            lastUpdated: null,
            lastChecked: null
        });

        const starMessage = await starboard.send({
            embeds: [
                this.buildStarEmbed(message, reaction)
            ]
        });

        await this.sql.setStarred.run({
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            starId: starMessage.id,
            lastUpdated: Date.now(),
            lastChecked: Date.now()
        });
    }

    async updateStar(message, reaction, starEntry) {
        const starboard = message.guild.channels.cache.get(this.starboardId);
        if (!starboard) return;

        const starMessage = await starboard.messages.fetch(starEntry.star_id.toString());

        await starMessage.edit({
            embeds: [
                this.buildStarEmbed(message, reaction)
            ]
        });

        await this.sql.setStarred.run({
            messageId: starEntry.message_id,
            channelId: starEntry.channel_id,
            guildId: starEntry.guild_id,
            starId: starEntry.star_id,
            lastUpdated: Date.now(),
            lastChecked: Date.now()
        });
    }

    buildStarEmbed(message, reaction) {
        return new MessageEmbed()
            .setAuthor(message.member?.nickname ?? message.author.username,
                message.author.avatarURL({
                    dynamic: false,
                    format: 'png'
                })
            )
            .setTitle('Jump to message')
            .setURL(message.url)
            .setDescription(message.content)
            .setFooter(`${reaction.count} ⭐ | ${this.stringifyChannel(message.channel)}`)
            .setTimestamp(message.timestamp);
    }

    stringifyChannel(channel) {
        let name = `#${channel.name}`;

        if (channel.isThread() && channel.parent) {
            name += ` (in #${channel.parent.name})`;
        }

        return name;
    }

    getStarsEmoji(count) {
        for (const star of STAR_LEVELS) {
            if (count >= star.minimum) {
                return star.emoji;
            }
        }

        return '😔';
    }
}

module.exports = StarboardPlugin;
