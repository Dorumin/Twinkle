const Command = require('../structs/Command');
const { MessageAttachment } = require('discord.js');

class HTTPCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['http', 'catus'];

        this.shortdesc = `Sends a catus code image.`;
        this.desc = `Sends a HTTP error's cat error code image from http.cat`;
        this.usages = [
            '!http 404'
        ];

        this.validCodes = [
            100, 101, 102, 103, 200, 202, 203, 204, 205, 206, 207, 300,
            301, 302, 303, 304, 305, 306, 307, 400, 401, 402, 403, 404, 405, 406, 407,
            408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 422, 423, 424, 425,
            426, 449, 450, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510
        ];
    }

    call(message, content) {
        if (!content) return;

        const code = parseInt(content);
        if (isNaN(code)) return;

        if (this.validCodes.includes(code)) {
            return message.channel.send({
                content: `<https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${code}>`,
                files: [new MessageAttachment(`https://http.cat/${code}.jpg`, `${code}.jpg`)]
            });
        }

        return message.channel.send(`https://http.cat/404.jpg`);
    }
}

module.exports = HTTPCommand;
