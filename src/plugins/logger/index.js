const fs = require('fs');
const path = require('path');
const Plugin = require('../../structs/plugin.js');
const Cache = require('../../structs/cache.js');

class LoggerPlugin extends Plugin {
    load() {
        this.bot.logger = new Logger(this.bot);
    }
}

class Logger {
    constructor(bot) {
        this.writers = new Cache();
        this.logPath = path.join(this.climb(__dirname, 3), 'log');

        fs.mkdir(this.logPath, () => {});

        bot.client.on('message', this.onMessage.bind(this));
    }

    onMessage(message) {
        if (message.content) {
            this.log('message', `${message.author.username}: ${message.content} @ ${message.guild.name}#${message.channel.name}`);
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

        const general = this.writers.get('main', () => fs.createWriteStream(path.join(this.logPath, 'main.txt'), { flags: 'a' }));
        // const channel = this.writers.get(label, () => fs.createWriteStream(path.join(this.logPath, `${label}.txt`), { flags: 'a' }));

        console.log(`[${label}] ${message}`);
        general.write(`[${label}] ${message}\n`);
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

    stringifyEmbed(embed) {
        const lines = [];

        if (embed.author && embed.author.name) {
            const name = embed.author.url
                ? `[${embed.author.name}](${embed.author.url})`
                : `${embed.author.name}`;

            if (embed.author.iconURL) {
                lines.push(`(${embed.author.iconURL}) ${name}`);
            } else {
                lines.push(`${name}`);
            }
        }

        if (embed.title) {
            if (embed.url) {
                lines.push(`[${embed.title}](${embed.url})`);
            } else {
                lines.push(`${embed.title}`);
            }

            if (embed.thumbnail) {
                lines[lines.length - 1] += ` • ${embed.thumbnail.url}`;
            }
        }

        if (embed.description) {
            lines.push(`\n${embed.description}`);
        }

        if (embed.fields.length) {
            for (const field of embed.fields) {
                lines.push(`${field.name}:`);
                lines.push(field.value.split('\n').map(line => `  ${line}`).join('\n'));
            }
        }

        if (embed.image) {
            lines.push(``, `${embed.image.url}`, ``);
        }

        if (embed.video) {
            lines.push(``, `${embed.video.url}`, ``);
        }

        if (embed.footer) {
            if (embed.timestamp) {
                lines.push(`${embed.footer.text} • ${this.formatTime(embed.timestamp)}`);
            } else {
                lines.push(`${embed.footer.text}`);
            }
        }

        return lines.join('\n').replace(/\n+/, '\n').trim();
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