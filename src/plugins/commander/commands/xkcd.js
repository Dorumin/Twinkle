const got = require('got');
const Command = require('../structs/Command.js');

class XKCDCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['xkcd', 'theresanxkcdforthat'];

        this.shortdesc = 'You know how the old saying goes...';
        this.desc = `... *There's an xkcd for that*

            Searches XKCD for a matching keyword or name.
            If input is a number, the number's link will be sent.
        `;
		this.usages = [
			'!xkcd [input]'
        ];
        this.examples = [
            '!xkc lisp',
            '!xkc 537'
        ];
    }

    async call(message, content) {
        if (!content) {
            message.channel.send('https://xkcd.com/');
            return;
        }

        if (!Number.isNaN(parseInt(content))) {
            message.channel.send(`https://xkcd.com/${content}`);
            return;
        }

        const bawdy = await got.post('https://relevant-xkcd-backend.herokuapp.com/search', {
            form: {
                search: content
            }
        }).json();

        if (bawdy.results.length === 0) return;
        const post = bawdy.results[0];

        message.channel.send({
            embed: {
                title: post.title,
                url: `https://xkcd.com/${post.number}`,
                image: {
                    url: post.image
                },
                footer: {
                    text: post.titletext
                },
                timestamp: new Date(post.date).toISOString()
            }
        });
    }
}

module.exports = XKCDCommand;