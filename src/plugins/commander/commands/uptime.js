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

    call(message) {
        const client = bot.client;
        const time = client.uptime;

        const toTimeString = (time) => {
            const f = Math.floor,
                s = f(time / 1000),
                m = f(s / 60),
                h = f(m / 60),
                d = f(h / 24);

            const seconds = `${s % 60} second${s > 1 ? `s` : ''}`;
            const minutes = `${m % 60} minute${m > 1 ? `s`: ''}`;
            const hours = `${h % 24} hour${h > 1 ? `s` : ''}`;

            if (d) {
                const days = `${d} day${d > 1 ? `s` : ''}`;

                return `${days}, ${hours}, ${minutes} and ${seconds} `;
            }

            return `${hours}, ${minutes} and ${seconds}`;
        }

        const uptime = toTimeString(time);

        message.channel.send(`Bot has been up and running for ${uptime}!`);
    }
}

module.exports = RuntimeCommand;
