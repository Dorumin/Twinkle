import fs from 'fs';
import path from 'path';
import * as t from 'io-ts';

import assert, { Optional } from 'assertmin';
import Twinkle from '../../Twinkle';
import Plugin from '../../structs/Plugin';
import Cache from '../../structs/Cache';
import FormatterPlugin from '../fmt';

import { Message, MessageEmbed } from 'discord.js';
import { ConfigProvider } from '../../structs/Config';
import { definePrivate } from '../../util/define';

function climbPath(p: string, count: number) {
    while (count--) {
        p = path.dirname(p);
    }

    return p;
}

function pad(n: number, len = 2, char = '0') {
    return (new Array(len).join(char) + n).slice(-len);
}

const LOG_THROTTLE = 1000;
const DISCORD_MESSAGE_LIMIT = 2000;

const LoggerConfigSchema = t.type({
    CHANNEL: t.string
});

export default class LoggerPlugin extends Plugin {
    private fmt!: FormatterPlugin;

    writers: Cache<string, fs.WriteStream>;
    logPath: string;
    logTimeout: number | NodeJS.Timeout;
    logBuffer: string[];

    loggerConfig: t.TypeOf<typeof LoggerConfigSchema>;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        definePrivate(this, 'fmt', bot.loadPlugin(FormatterPlugin));

        this.loggerConfig = config.getOptionTyped('LOGGER', LoggerConfigSchema);

        this.writers = new Cache();
        this.logPath = path.join(climbPath(__dirname, 3), 'log');

        this.logBuffer = [];
        this.logTimeout = -1;
    }

    async load() {
        fs.mkdir(this.logPath, () => {});

        this.bot.listen('messageCreate', this.onMessage, this);
    }

    onMessage(message: Message) {
		// if (message.author.bot && message.author.id !== this.bot.client.user.id) return;
		if (this.loggerConfig.CHANNEL && message.channel.id === this.loggerConfig.CHANNEL) return;

        const place = message.channel.type === 'DM'
            ? 'DMs'
            : `${message.guild?.name}#${message.channel.name}`;

        let entry = `${message.author.username}`;

        if (message.content) {
            entry += `: ${message.content}`;
        }

        this.log('message', `${entry} @ ${place}`);

        if (message.attachments.size) {
            for (const attachment of message.attachments.values()) {
                this.log('attachment', attachment.url);
            }
        }

        if (message.embeds.length) {
            for (const embed of message.embeds) {
                this.log('embed', this.stringifyEmbed(embed));
            }
        }
    }

    handle(label: string) {
        return this.log.bind(this, label);
    }

    log(label: string, message: string) {
        if (!message) {
            message = label;
            label = 'channel';
        }

        const logEntry =`[${label}] ${message}`;
        const general = this.writers.get('main', () => fs.createWriteStream(path.join(this.logPath, 'main.txt'), { flags: 'a' }));
        // const channel = this.writers.get(label, () => fs.createWriteStream(path.join(this.logPath, `${label}.txt`), { flags: 'a' }));

        console.info(logEntry);
        general.write(logEntry + '\n');

        if (this.loggerConfig.CHANNEL && this.bot.loggedIn) {
            const channel = this.bot.client.channels.cache.get(this.loggerConfig.CHANNEL);

            if (!channel) return;

            const message = this.fmt.codeBlock('toml', logEntry);
            if (message.length <= 2000) {
                this.queueLog(message);
            }
        }
        // channel.write(`${message}\n`);
    }

    getBuffer() {
        return this.logBuffer.join(''); // note: not joined with newlines
    }

    queueLog(message: string) {
        const curlen = this.getBuffer().length;

        if (curlen + message.length > DISCORD_MESSAGE_LIMIT) {
            this.flushLogs()
        }

        this.logBuffer.push(message);

        if (this.logTimeout !== -1) return;

        this.logTimeout = setTimeout(this.flushLogs.bind(this), LOG_THROTTLE);
    }

    flushLogs() {
        this.logTimeout = -1;

        const channel = this.bot.client.channels.cache.get(this.loggerConfig.CHANNEL);

        if (channel && channel.isText()) {
            const buffer = this.getBuffer();

            if (buffer.trim()) {
                channel.send(this.getBuffer()).catch(error => {
                    this.bot.reportError('Log send error', error);
                });
            }
        }

        this.logBuffer = [];
    }

    getLog(name: string) {
        return fs.promises.readFile(path.join(this.logPath, `${name}.txt`), {
            encoding: 'utf-8'
        });
    }

    suppress(message: Message) {
        // Don't do anything
        message;
    }

    logStream(name: string) {

    }

    stringifyEmbed({ provider, author, title, url, thumbnail, description, fields, image, video, footer, timestamp }: MessageEmbed) {
        const sections: string[][] = new Array(4).fill(null).map(() => []);

        if (provider) {
            let str = provider.name;

            if (provider.url) {
                str += ` - ${provider.url}`;
            }

            sections[0].push(str);
        }

        if (author && author.name) {
            const name = author.url
                ? `[${author.name}](${author.url})`
                : `${author.name}`;

            if (author.iconURL) {
                sections[0].push(`(${author.iconURL}) ${name}`);
            } else {
                sections[0].push(`${name}`);
            }
        }

        if (title) {
            let str = url
                ? `[${title}](${url})`
                : `${title}`;

            if (thumbnail && !video) {
                str += ` • ${thumbnail.url}`;
            }

            sections[0].push(str);
        }

        if (description) {
            sections[0].push(`${description}`);
        }

        if (fields.length) {
            for (const field of fields) {
                sections[1].push(`${field.name}:`);
                sections[1].push(this.fmt.indent(field.value, 2));
            }
        }

        if (image) {
            sections[2].push(`${image.url}`);
        }

        if (video) {
            if (thumbnail) {
                sections[2].push(`${thumbnail.url}`);
            }

            sections[2].push(`${video.url}`);
        }

        if (footer) {
            if (timestamp) {
                sections[3].push(`${footer.text} • ${this.formatTime(timestamp)}`);
            } else {
                sections[3].push(`${footer.text}`);
            }
        }

        return sections
            .filter(section => section.length)
            .map(section => section.join('\n'))
            .join('\n\n');
    }

    formatTime(timestamp: number) {
        const d = new Date(timestamp);
        const date = pad(d.getUTCDate());
        const month = pad(d.getUTCMonth() + 1);
        const year = pad(d.getUTCFullYear());
        const hour = pad(d.getUTCHours());
        const mins = pad(d.getUTCMinutes());
        const secs = pad(d.getUTCSeconds());

        return `${date}/${month}/${year} ${hour}:${mins}:${secs}`;
    }
}
