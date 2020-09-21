const util = require('util');
const child_process = require('child_process');
const { Collection } = require('discord.js');
const Command = require('../structs/Command.js');
const OPCommand = require('../structs/OPCommand.js');
const FormatterPlugin = require('../../fmt');

class EvalCommand extends OPCommand {
    static get deps() {
        return [
            FormatterPlugin
        ];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['eval'];
        this.hidden = true;

        this.shortdesc = `Evaluates a piece of code.`;
        this.desc = `
                    Runs JavaScript in a non-sandboxed environment, and returns the value if it exists.
                    If you use a code block, it will get stripped out before evaluation.
                    You need to be a bot operator to use this command.`;
        this.usages = [
            '!eval <code>'
        ];
        this.examples = [
            '!eval send("Hello, world!")',
            '!eval 2 + 2 * 2 ** 2',
            '!eval ```js\nawait message.react("🤔");```'
        ];
	}

	inspect(object) {
		let str = '';
		let depth = 3;

		while (depth--) {
			str = this.bot.fmt.codeBlock('js',
				util.inspect(object, {
					depth,
					compact: false
				})
			);

			if (str.length < 2000) break;
		}

		return str;
	}

    stringify(val, forCode) {
        if (val instanceof Collection) {
            if (forCode) {
                val = val.array();
            } else {
                return val.array();
            }
        }

        if (val instanceof Array) {
            if (forCode) {
                const json = JSON.stringify(val, null, 2);

                return this.bot.fmt.codeBlock('json', json);
            }

            return val;
        }

        if (val instanceof Promise) {
            if (forCode) return null;

            return val;
		}

		if (val instanceof Function) {
			const stringified = val.toString();
			const lastLine = stringified.slice(stringified.lastIndexOf('\n') + 1);
			const indent = lastLine.match(/^\s*/)[0]; // Will always match due to zero-width *

			return this.bot.fmt.codeBlock('js', indent + stringified);
		}

		if (val instanceof Map) {
			return this.inspect(val);
		}

        if (String(val) === '[object Object]') {
			try {
				const json = JSON.stringify(val, null, 2);
				return this.bot.fmt.codeBlock('json', json);
			} catch(e) {
				return this.inspect(val);
			}
        }

        if (typeof val === 'string' && val === '') {
            const json = JSON.stringify(val);

            if (forCode) {
                return this.bot.fmt.codeBlock('json', json);
            }

            return json;
		}

		if (typeof val === 'boolean') {
			return String(val);
		}

        return val;
    }

    require(send, name) {
        try {
            return require(name);
        } catch(e) {
            send(`Dynamically loading ${name}...`);
            child_process.execSync(`npm install ${name}`);

            return require(name);
        }
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

        const send = (...args) => {
            args = args.map((arg) => {
                if (String(arg) == '[object Object]') {
                    if (arg.hasOwnProperty('embed')) {
                        return arg;
                    }
                }

                return this.stringify(arg);
            });

            return message.channel.send(...args);
        };
        const bot = this.bot;
        const db = bot.db;
        const client = bot.client;
        const got = require('got');
        const { channel, member, author, guild } = message;
        const require = this.require.bind(this, send);
        let module = { exports: null };

        this.constructor.use(send, bot, db, client, got, channel, member, author, guild);

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
                    const message = this.stringify(result, true);

                    if (message) {
                        await send(message);
                    }
                }
            } else {
                const result = eval(code);

                if (result !== undefined) {
                    const message = this.stringify(result, true);

                    if (message) {
                        await send(message);
                    }
                }
            }
        } catch(e) {
            await send(this.bot.fmt.codeBlock('http', `${e}`));
        }

        if (module.exports instanceof Command) {
            bot.commander.loadCommand(module.exports, 'eval');
            await send(`Registered new command ${module.exports.name}`);
        }
    }

    static use() {}
}

module.exports = EvalCommand;
