const util = require('util');
const child_process = require('child_process');
const { BaseManager, Collection } = require('discord.js');
const Command = require('../structs/Command.js');
const OPCommand = require('../structs/OPCommand.js');
const FormatterPlugin = require('../../fmt');

const _require = require;

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

    require(channel, name) {
        try {
            return require(name);
        } catch(e) {
            // This is a HACK to essentially send a message on another thread
            // I use curl because I can't be assed to spawn a small js file to post with got
            // I tried to make this look as pretty as possible
            const url = `https://discord.com/api/v6/channels/${channel.id}/messages`;
            const body = JSON.stringify({
                content: `Dynamically loading ${name}...`
            });
            const headers = [
                ['Content-Type', 'application/json'],
                ['Authorization', `Bot ${this.bot.client.token}`]
            ].map(([k, v]) => `-H "${k}: ${v}"`).join(' ');

            // curl will start on another thread, and npm install with block this thread
            child_process.exec(`curl --data '${body}' ${headers} ${url}`);
            child_process.execSync(`npm install ${name}`);

            // Clear require cache
            delete require.cache[require.resolve(name)];

            return require(name);
        }
    }

    patchManagerClasses() {
        BaseManager.prototype.get = function(key) {
            return this.cache.get(key);
        };
    }

    unpatchManagerClasses() {
        delete BaseManager.prototype.get;
    }

    getCode(content) {
        let code = content;
        if (code.startsWith('```') && code.endsWith('```')) {
            code = code.slice(3, -3);
            if (['js', 'javascript'].includes(code.split('\n', 1)[0])) {
                code = code.replace(/^.+/, '');
            }
        }
        code = code.replace(/;+$/g, '');

        const isAsync = code.includes('await');
        const isSingleStatement = !code.includes(';');

        if (isAsync) {
            code = `(async () => {
                ${isSingleStatement ? 'return ' : ''}${code};
            })()`;
        }

        return code;
    }

    getVars(message) {
        return {
            send: (...args) => {
                args = args.map((arg) => {
                    if (String(arg) == '[object Object]') {
                        if (arg.hasOwnProperty('embed')) {
                            return arg;
                        }
                    }

                    return this.stringify(arg);
                });

                return message.channel.send(...args);
            },

            bot: this.bot,
            client: this.bot.client,
            commander: this.bot.commander,
            fmt: this.bot.fmt,
            db: this.bot.db,

            channel: message.channel,
            member: message.member,
            author: message.author,
            guild: message.guild,

            require: this.require.bind(this, message.channel),
            got: require('got'),
            module: { exports: null }
        };
    }

    async call(message, content) {
        const code = this.getCode(content);

        const {
            send,

            bot,
            client,
            commander,
            fmt,
            db,

            channel,
            member,
            author,
            guild,

            require,
            got,
            module
        } = this.getVars(message);

        this.constructor.use(
            send, bot, client, commander, fmt, db,
            channel, member, author, guild, require, got, module
        );

        this.patchManagerClasses();

        try {
            const result = await eval(code);

            if (result !== undefined) {
                const message = this.stringify(result, true);

                if (message) {
                    await send(message);
                }
            }
        } catch(e) {
            await send(this.bot.fmt.codeBlock('http', `${e}`));
        }

        this.unpatchManagerClasses();

        if (Command.isPrototypeOf(module.exports)) {
            bot.commander.loadCommand(module.exports, module.exports.name);

            await send(`Registered a new command: ${module.exports.name}`);
        }
    }

    static use() {}
}

module.exports = EvalCommand;
