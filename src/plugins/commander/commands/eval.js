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
        code = code.replace(/;+$/g, '');

        console.log(content);

        const stringify = (val) => {
            if (val instanceof Collection) return val.array();
            if (String(val) == '[object Array]') return '```json\n' + JSON.stringify(val, null, 2) + '```';
            if (String(val) == '[object Object]') return '```json\n' + JSON.stringify(val, null, 2) + '```';

            return val;
        };
        const send = (...args) => {
            args = args.map((arg) => {
                if (String(arg) == '[object Object]') {
                    if (arg.hasOwnProperty('embed')) {
                        return arg;
                    }
                }

                return stringify(arg);
            });

            return message.channel.send(...args);
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