const fs = require('fs');
const path = require('path');
const Plugin = require('../../structs/Plugin.js');
const Cache = require('../../structs/Cache.js');
const FormatterPlugin = require('../fmt');

class LoggerPlugin extends Plugin {
    static get deps() {
        return [
            FormatterPlugin
        ];
    }

    load() {
        this.bot.logger = new Logger(this.bot);
    }
}

class Logger {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.LOGGER;
        this.writers = new Cache();
        this.logPath = path.join(this.climb(__dirname, 3), 'log');

        fs.mkdir(this.logPath, () => {});

        bot.client.on('message', this.onMessage.bind(this));
    }

    onMessage(message) {
        if (this.config.CHANNEL && message.channel.id == this.config.CHANNEL) return;

        if (message.content) {
            const place = message.channel.type == 'dm'
                ? 'DMs'
                : `${message.guild.name}#${message.channel.name}`;

            let entry = `${message.author.username}`;

            if (message.content) {
                entry += `: ${message.content}`;
            }

            this.log('message', `${entry} @ ${place}`);
        }

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

    log(label, message) {
        if (!message) {
            message = label;
            label = 'channel';
        }

        const logEntry =`[${label}] ${message}`;
        const general = this.writers.get('main', () => fs.createWriteStream(path.join(this.logPath, 'main.txt'), { flags: 'a' }));
        // const channel = this.writers.get(label, () => fs.createWriteStream(path.join(this.logPath, `${label}.txt`), { flags: 'a' }));

        console.log(logEntry);
        general.write(logEntry + '\n');

        if (this.config.CHANNEL) {
            const channel = this.bot.client.channels.get(this.config.CHANNEL);

            if (!channel) return;

            if (this.config.CATEGORIES) {
                throw new Error('Unimplemented category splitting');
            } else {
                channel.send(this.bot.fmt.codeBlock('toml', logEntry));
            }
        }
        // channel.write(`${message}\n`);
    }

    getLog(name) {
        return new Promise((res, rej) => {
            fs.readFile(path.join(this.logPath, `${name}.txt`), (err, data) => {
                if (err) {
                    rej(err);
                    return;
                }

                res(data.toString());
            });
        });
    }

    climb(p, count) {
        while (count--) {
            p = path.dirname(p);
        }
        return p;
    }

    suppress(message) {
        // Don't do anything
        message;
    }

    logStream(name) {

    }

    stringifyEmbed({ provider, author, title, url, thumbnail, description, fields, image, video, footer, timestamp }) {
        const sections = new Array(4).fill(null).map(() => []);

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
                sections[1].push(field.value.split('\n').map(line => `  ${line}`).join('\n'));
            }
        }

        if (image) {
            sections[2].push(`${image.url}`);
        }

        if (video) {
            if (thumbnail) {
                sections[2].push(`${thumbnail.url}`)
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

    formatTime(timestamp) {
        const d = new Date(timestamp),
        date = this.pad(d.getUTCDate()),
        month = this.pad(d.getUTCMonth() + 1),
        year = this.pad(d.getUTCFullYear()),
        hour = this.pad(d.getUTCHours()),
        mins = this.pad(d.getUTCMinutes()),
        secs = this.pad(d.getUTCSeconds());

        return `${date}/${month}/${year} ${hour}:${mins}:${secs}`;
    }

    pad(n, len = 2, char = '0') {
        return (new Array(len).join(char) + n).slice(-len);
    }
}

module.exports = LoggerPlugin;
