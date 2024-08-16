import { Message, MessageEmbed, MessageReaction, TextChannel, ThreadChannel, User } from 'discord.js';
import * as t from 'io-ts';

import Plugin from '../../structs/Plugin';
import SQLPlugin, { SQLHandle } from '../sql';
import Twinkle from '$src/Twinkle';
import { ConfigProvider } from '$src/structs/Config';

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

const StarboardConfigSchema = t.type({
    THRESHOLD: t.number,
    STARBOARD_ID: t.string
});

type StarEntry = {
    message_id: string;
    channel_id: string;
    guild_id: string;
    star_id: string;
    last_updated: number;
    last_checked: number;
};

export default class StarboardPlugin extends Plugin {
    private config: t.TypeOf<typeof StarboardConfigSchema>;
    private sqlPlugin: SQLPlugin;
    private sql: SQLHandle<'getStarred' | 'setStarred'>;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.config = config.getOptionTyped('STARBOARD', StarboardConfigSchema);

        this.sqlPlugin = bot.loadPlugin(SQLPlugin);
        this.sql = this.sqlPlugin.handle('starboard')
            .with(
                'getStarred',
                `
                    SELECT *
                    FROM starboard_starred_v1
                    WHERE
                        message_id = ?
                `,
                s => s.safeIntegers()
            )
            .with(
                'setStarred',
                `
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
                `,
                s => s.safeIntegers()
            );
        this.sql.exec(`CREATE TABLE IF NOT EXISTS starboard_starred_v1 (
            message_id INTEGER PRIMARY KEY,
            channel_id INTEGER NOT NULL,
            guild_id INTEGER,
            star_id INTEGER,
            last_updated INTEGER,
            last_checked INTEGER
        )`);

        bot.listenPartial('messageReactionAdd', this.onReaction, this);
        bot.listenPartial('messageReactionRemove', this.onReaction, this);
    }

    async onReaction(reaction: MessageReaction, user: User) {
        // Only stars allowed
        if (reaction.emoji.name !== STAR) return;

        await reaction.fetch();

        const message = await reaction.message.fetch();

        // await message.fetch();

        // Don't star starboard posts
        if (message.channel.id === this.config.STARBOARD_ID && message.author.id === this.bot.client.user?.id) return;

        const guild = message.guild;

        if (!guild) return;

        // Ignore in dev mode if outside of dev guild
        if (this.bot.onlyDev(guild)) return;

        const member = await guild.members.fetch(user.id);
        const isMod = member.permissions.has(MANAGE_MESSAGES);

        const starEntry = await this.sql.statement('getStarred').get(message.id);

        if (starEntry) {
            await this.updateStar(message, reaction, starEntry as StarEntry);
        } else {
            if (isMod || reaction.count >= this.config.THRESHOLD) {
                await this.star(message, reaction);
            }
        }
    }

    async star(message: Message, reaction: MessageReaction) {
        if (!message.guild) return;

        const starboard = message.guild.channels.cache.get(this.config.STARBOARD_ID);
        if (!(starboard instanceof TextChannel)) return;

        await this.sql.statement('setStarred').run({
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

        await this.sql.statement('setStarred').run({
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            starId: starMessage.id,
            lastUpdated: Date.now(),
            lastChecked: Date.now()
        });
    }

    async updateStar(message: Message, reaction: MessageReaction, starEntry: StarEntry) {
        if (!message.guild) return;

        const starboard = message.guild.channels.cache.get(this.config.STARBOARD_ID);
        if (!(starboard instanceof TextChannel)) return;

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

        await this.sql.statement('setStarred').run({
            messageId: starEntry.message_id,
            channelId: starEntry.channel_id,
            guildId: starEntry.guild_id,
            starId: starEntry.star_id,
            lastUpdated: Date.now(),
            lastChecked: Date.now()
        });
    }

    buildStarEmbed(message: Message, reaction: MessageReaction) {
        const props = this.getMessageProps(message);
        const embed = new MessageEmbed()
            .setAuthor(message.member?.nickname ?? message.author.username,
                message.author.avatarURL({
                    dynamic: false,
                    format: 'png'
                }) ?? undefined
            )
            .setTitle('Jump to message')
            .setURL(message.url)
            .setDescription(props.content)
            .setImage(props.image ?? '')
            .setFooter(`${reaction.count} ${this.getStarsEmoji(reaction.count ?? 0)} | ${this.stringifyChannel(message.channel as TextChannel)}`)
            .setTimestamp(message.createdTimestamp);

        return embed;
    }

    getMessageProps(message: Message) {
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
            const sticker = message.stickers.first()!;

            if (sticker.format === 'PNG' || sticker.format === 'APNG') {
                image = sticker.url;
            }
        }


        if (image === undefined && message.embeds.length) {
            const embed = message.embeds.find(embed => embed.image || embed.type === 'image');

            if (embed) {
                image = embed.image?.url ?? embed.url ?? undefined;
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

    stringifyChannel(channel: TextChannel | ThreadChannel) {
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
    }: MessageEmbed) {
        const sections: string[][] = new Array(4).fill(null).map(() => []);

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


    getStarsEmoji(count: number) {
        for (const star of STAR_LEVELS) {
            if (count >= star.minimum) {
                return star.emoji;
            }
        }

        return '😔';
    }
}
