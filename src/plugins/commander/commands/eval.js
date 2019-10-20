const { Collection } = require('discord.js');
const OPCommand = require('../structs/opcommand.js');

class EvalCommand extends OPCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['eval'];
        this.hidden = true;

        this.shortdesc = 'Evaluates a piece of code.';
        this.desc = 'Runs JavaScript in a non-sandboxed environment, and returns the value if it exists.\nIf you use a code block, it will get stripped out before evaluation.\nYou need to be a bot operator to use this command.';
        this.usages = [
            '!eval <code>'
        ];
        this.examples = [
            '!eval send("Hello, world!")',
            '!eval 2 + 2 * 2 ** 2',
            '!eval ```js\nawait message.react("🤔");```'
        ];
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

        const stringify = (val, forCode) => {
            if (val instanceof Collection) {
                if (forCode) {
                    val = val.array();
                } else {
                    return val.array();
                }
            }
            if (String(val) == '[object Array]') {
                const json = JSON.stringify(val, null, 2);
                if (forCode) return json;
                return '```json\n' + json + '```';
            }
            if (String(val) == '[object Object]') {
                const json = JSON.stringify(val, null, 2);
                if (forCode) return json;
                return '```json\n' + json + '```';
            }
            if (typeof val == 'string' && forCode) return JSON.stringify(val);

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
                    send('```js\n' + stringify(result, true) + '```');
                }
            } else {
                const result = eval(code);
                if (result !== undefined) {
                    send('```js\n' + stringify(result, true) + '```');
                }
            }
        } catch(e) {
            send('```http\n' + e + '```');
        }
    }

    static use() {}
}

module.exports = EvalCommand;