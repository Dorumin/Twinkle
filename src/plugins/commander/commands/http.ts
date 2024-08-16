import { Message, MessageAttachment } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';

const VALID_CODES = [
    100, 101, 102, 200, 201, 202, 203, 204, 206, 207, 300, 301,
    302, 303, 304, 305, 307, 308, 400, 401, 402, 403, 404, 405,
    406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417,
    418, 420, 421, 422, 423, 424, 425, 426, 429, 431, 444, 450,
    451, 497, 498, 499, 500, 501, 502, 503, 504, 506, 507, 508,
    509, 510, 511, 521, 523, 525, 599
];

export default class HTTPCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['http', 'catus'];
        this.schema = new SlashCommandBuilder()
            .addIntegerOption(option =>
                option.setName('code')
                    .setDescription('The http code to fetch the cat of')
                    .setRequired(true)
            );

        this.shortdesc = `Sends a catus code image.`;
        this.desc = `Sends a HTTP error's cat error code image from http.cat`;
        this.usages = [
            '!http 404'
        ];
    }

    call(message: Message, content: string) {
        if (!content) return;

        const code = parseInt(content);
        if (isNaN(code)) return;

        if (VALID_CODES.includes(code)) {
            return message.channel.send({
                content: `<https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${code}>`,
                files: [
                    new MessageAttachment(`https://http.cat/${code}.jpg`, `${code}.jpg`)
                ]
            });
        }

        return message.channel.send(`https://http.cat/404.jpg`);
    }
}
