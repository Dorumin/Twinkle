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

        const send = (...args) => {
            args = args.map(arg => {
                if (arg instanceof Collection) return arg.array();
                if (String(arg) == '[object Object]') return '```json\n' + JSON.stringify(arg, null, 2) + '```';

                return arg;
            });

            message.channel.send(...args);
        };
        const bot = this.bot;
        const client = bot.client;
        const got = require('got');

        this.constructor.use(send, bot, client, got);

        try {
            // Weak assertions, used to restrict functionality *in case of*, not enable it
            const isAsync = code.includes('await');
            const isSingleStatement = !code.includes(';');
            if (isAsync) {
                const promise = eval(`(async () => {
                    ${isSingleStatement ? 'return ' : ''}${code};
                })()`);
                const result = await promise;

                if (result !== undefined) {
                    send('```js\n' + result + '```');
                }
            } else {
                const result = eval(code);
                if (result !== undefined) {
                    send('```js\n' + result + '```');
                }
            }
        } catch(e) {
            send('```http\n' + e + '```');
        }
    }

    static use() {}
}

module.exports = EvalCommand;