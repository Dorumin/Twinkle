const Command = require('../structs/Command.js');

class RuntimeCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['runtime', 'uptime'];

        this.shortdesc = `Tells you how long the bot has been up.`;
        this.desc = `..Tells you how long the bot has been up`;
        this.usages = [
            '!runtime',
            '!uptime',
        ];
    }

    toTimeString(time) {
        const f = Math.floor,
            s = f(time / 1000),
            m = f(s / 60),
            h = f(m / 60),
            d = f(h / 24);

        const p = (n, singular, plural) => n === 1 ? singular : plural;

        const seconds = `${s % 60} ${p(s, 'second', 'seconds')}`;
        const minutes = `${m % 60} ${p(m, 'minute', 'hours')}`;
        const hours = `${h % 24} ${p(h, 'hour', 'hours')}`;

        if (d) {
            const days = `${d} day${p(d, 'day', 'days')}`;

            return `${days}, ${hours}, ${minutes} and ${seconds} `;
        }

        return `${hours}, ${minutes} and ${seconds}`;
    }

    call(message) {
        const uptime = this.toTimeString(this.bot.client.uptime);

        message.channel.send(`Bot has been up and running for ${uptime}!`);
    }
}

module.exports = RuntimeCommand;
