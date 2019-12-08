const got = require('got');
const Command = require('../structs/Command.js');
const FandomizerPlugin = require('../../fandomizer');
const FormatterPlugin = require('../../fmt');

class ParseCommand extends Command {
    static get deps() {
        return [
            FandomizerPlugin,
            FormatterPlugin
        ];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['parse'];

        this.shortdesc = `Parses wikitext and spits out the resulting HTML.`
        this.desc = `
                    Parses wikitext and spits out the resulting HTML.
                    You can't get the bot's IP through this method.`;
        this.usages = [
            '!parse <wikitext>'
        ];
        this.examples = [
            '!parse {{#replace:{{#invoke:datecalc|main|diff|2019/12/01}}|-}}',
            '!parse whatever wikitext magic puxlit comes up with'
        ];
    }

    async call(message, content) {
        const wiki = 'dev', // @Hardcoded
        url = await this.bot.fandomizer.url(wiki),
        result = await got(`${url}/api.php`, {
            json: true,
            query: {
                action: 'parse',
                prop: 'text',
                text: content,
                disablepp: true,
                format: 'json'
            }
        }),
        text = result.body.parse.text['*'];

        message.channel.send(this.bot.fmt.codeBlock('html', text));
    }
}

module.exports = ParseCommand;
