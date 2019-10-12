const { Collection } = require('discord.js');
const OPCommand = require('../structs/opcommand.js');

class EvalCommand extends OPCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['eval'];
        this.hidden = true;
    }

    async call(message, content) {
        let code = content;
        if (code.startsWith('```') && code.endsWith('```')) {
            code = code.slice(3, -3);
            if (['js', 'javascript'].includes(code.split('\n', 1)[0])) {
                code = code.replace(/^.+/, '');
            }
        }

        console.log(content);

        let send = (...args) => {
            args = args.map(arg => {
                if (arg instanceof Collection) return arg.array();
                return arg;
            });

            message.channel.send(...args);
        };
        let bot = this.bot;
        let client = bot.client;

        this.constructor.use(send, bot, client);

        try {
            const promise = eval(`(async () => {
                ${code}
            })()`);
            await promise;
        } catch(e) {
            send('```http\n' + e + '```');
        }
    }

    static use() {}
}

module.exports = EvalCommand;