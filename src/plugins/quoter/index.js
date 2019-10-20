const got = require('got');
const Plugin = require('../../structs/plugin.js');

class QuoterPlugin extends Plugin {
    load() {
        this.bot.quoter = new Quoter(this.bot);
    }
}

class Quoter {
    constructor(bot) {
        this.bot = bot;
        this.QUOTE_PATTERN = /(?<!<)https?:\/\/(?:(?:canary|ptb)\.)?discordapp\.com\/channels\/(@me|\d+)\/(\d+)\/(\d+)(?!>)/gm;
        bot.client.on('message', this.onMessage.bind(this));
    }

    matchQuotes(text) {
        const matches = [];
        const regex = this.QUOTE_PATTERN;
        let m;

        regex.lastIndex = 0;

        while ((m = regex.exec(text)) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            matches.push(m);
        }

        return matches;
    }

    async onMessage(message) {
        const quotes = this.matchQuotes(message.content);
        if (!quotes.length) return;

        const messages = await Promise.all(quotes.map(this.tryFetchQuote.bind(this)));
        const filtered = messages.filter(quote => quote !== null);
        if (filtered.length === 0) return;

        const shouldDelete = message.content.replace(this.QUOTE_PATTERN, '').trim() === '';

        for (const i in filtered) {
            const quote = filtered[i];

            await message.channel.send({
                embed: this.buildQuoteEmbed(message, quote)
            });
        }

        if (shouldDelete) {
            try {
                message.delete();
            } catch(e) {
                // Swallow
            }
        }
    }

    async tryFetchQuote([_, guildId, channelId, messageId]) {
        try {
            const channel = this.bot.client.channels.get(channelId);
            if (!channel) return null;

            const messages = await channel.fetchMessages({ limit: 1, around: messageId });
            if (!messages.size) return null;

            const message = messages.first();
            if (message.id != messageId) return null;

            return message;
        } catch(e) {
            return null;
        }
    }

    buildQuoteEmbed(message, quote) {
        return {
            author: {
                icon_url: quote.author.displayAvatarURL,
                name: quote.member && quote.member.nickname || quote.author.username
            },
            title: 'Click to jump',
            url: `https://discordapp.com/channels/${quote.guild.id}/${quote.channel.id}/${quote.id}`,
            description: quote.content,
            footer: {
                icon_url: message.author.displayAvatarURL,
                text: `Quoted by ${message.author.username}#${message.author.discriminator}`
            },
            timestamp: quote.createdAt.toISOString()
        };
    }
}

module.exports = QuoterPlugin;