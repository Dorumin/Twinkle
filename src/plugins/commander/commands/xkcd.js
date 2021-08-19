const { SlashCommandBuilder } = require('@discordjs/builders');
const got = require('got');
const Command = require('../structs/Command.js');

class XKCDCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['xkcd', 'theresanxkcdforthat'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('search')
                    .setDescription('The search query or xkcd post number')
            );

        this.shortdesc = 'You know how the old saying goes...';
        this.desc = `... *There's an xkcd for that*

            Searches XKCD for a matching keyword or name.
            If input is a number, the number's link will be sent.
        `;
		this.usages = [
			'!xkcd [input]'
        ];
        this.examples = [
            '!xkcd lisp',
            '!xkcd 537'
        ];
    }

    async call(message, content) {
        if (!content) {
            return message.channel.send('https://xkcd.com/');
        }

        if (!Number.isNaN(parseInt(content))) {
            return message.channel.send(`https://xkcd.com/${content}`);
        }

        const bawdy = await got.post('https://relevant-xkcd-backend.herokuapp.com/search', {
            form: {
                search: content
            }
        }).json();

        if (bawdy.results.length === 0) return;
        const post = bawdy.results[0];

        return message.channel.send({
            embeds: [{
                title: post.title,
                url: `https://xkcd.com/${post.number}`,
                image: {
                    url: post.image
                },
                footer: {
                    text: post.titletext
                },
                timestamp: new Date(post.date).toISOString()
            }]
        });
    }
}

module.exports = XKCDCommand;
