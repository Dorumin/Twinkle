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
        // Only stars allowed
        if (reaction.emoji.name !== STAR) return;

        await reaction.fetch();

        const message = reaction.message;

        await message.fetch();

        // Don't star starboard posts
        if (message.channel.id === this.starboardId && message.author.id === this.bot.client.user.id) return;

        const guild = message.guild;

        if (!guild) return;

        // Ignore in dev mode if outside of dev guild
        if (this.bot.onlyDev(guild)) return;

        const member = await guild.members.fetch(user.id);
        const isMod = member.permissions.has(MANAGE_MESSAGES);

        const starEntry = await this.sql.getStarred.get(message.id);

        if (starEntry) {
            await this.updateStar(message, reaction, starEntry);
        } else {
            if (isMod || reaction.count >= this.threshold) {
                await this.star(message, reaction);
            }
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

        let starMessage;
        try {
            starMessage = await starboard.messages.fetch(starEntry.star_id.toString());
        } catch(e) {
            // Message was probably deleted; ignore
            return;
        }

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
        const props = this.getMessageProps(message);
        const embed = new MessageEmbed()
            .setAuthor(message.member?.nickname ?? message.author.username,
                message.author.avatarURL({
                    dynamic: false,
                    format: 'png'
                })
            )
            .setTitle('Jump to message')
            .setURL(message.url)
            .setDescription(props.content)
            .setImage(props.image)
            .setFooter(`${reaction.count} ${this.getStarsEmoji(reaction.count ?? 0)} | ${this.stringifyChannel(message.channel)}`)
            .setTimestamp(message.timestamp);

        return embed;
    }

    getMessageProps(message) {
        let content = '';
        let image;

        if (message.attachments.size) {
            const file = message.attachments.first();

            // TODO: Maybe do some proper contentType checking for images?
            // I just don't want to embed mp3s
            if (file && file.height && file.width) {
                image = file.url;
            }
        }

        if (image === undefined && message.stickers.size === 1) {
            const sticker = message.stickers.first();

            if (sticker.format === 'PNG' || sticker.format === 'APNG') {
                image = sticker.url;
            }
        }


        if (image === undefined && message.embeds.length) {
            const embed = message.embeds.find(embed => embed.image || embed.type === 'image');

            if (embed) {
                image = embed.image?.url ?? embed.url;
            }
        }

        if (message.content) {
            if (image === undefined && /^https:\/\/cdn\.discordapp\.com\/attachments\/\d+\/\d+\/\S+$/.test(message.content)) {
                image = message.content;
                content = '';
            } else {
                content = message.content;
            }
        } else if (message.embeds.length) {
            content = this.stringifyEmbed(message.embeds[0]);
        }

        return {
            content,
            image
        };
    }

    stringifyChannel(channel) {
        let name = `#${channel.name}`;

        if (channel.isThread() && channel.parent) {
            name += ` (in #${channel.parent.name})`;
        }

        return name;
    }

    stringifyEmbed({
        provider,
        author,
        title,
        url,
        description,
        fields,
        footer,
        timestamp
    }) {
        const sections = new Array(4).fill(null).map(() => []);

        if (provider) {
            sections[0].push(provider.name);
        }

        if (author && author.name) {
            const name = author.url
                ? `[${author.name}](${author.url})`
                : `${author.name}`;

            sections[0].push(`${name}`);
        }

        if (title) {
            let str = url
                ? `[${title}](${url})`
                : `${title}`;

            sections[0].push(str);
        }

        if (description) {
            sections[0].push(`${description}`);
        }

        if (fields.length) {
            for (const field of fields) {
                sections[1].push(`${field.name}:`);
                sections[1].push(field.value.split('\n').map(line => `  ${line}`).join('\n'));
            }
        }

        if (footer) {
            if (timestamp) {
                sections[3].push(`${footer.text} • <t:${Math.floor(new Date(timestamp).getTime() / 1000)}:f>`);
            } else {
                sections[3].push(`${footer.text}`);
            }
        }

        return sections
            .filter(section => section.length)
            .map(section => section.join('\n'))
            .join('\n\n');
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
