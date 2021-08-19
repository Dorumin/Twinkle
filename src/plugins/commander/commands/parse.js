const got = require('got');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { parse, HTMLElement } = require('node-html-parser');
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
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('wikitext')
                    .setDescription('The wikitext to parse')
                    .setRequired(true)
            );

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
        const wiki = 'dev'; // @Hardcoded
        const url = await this.bot.fandomizer.url(wiki);
        const result = await got(`${url}/api.php`, {
            searchParams: {
                action: 'parse',
                prop: 'text',
                text: content,
                disablepp: true,
                format: 'json'
            }
        }).json();
        const text = result.parse.text['*'];
        const tree = parse(text);

        let html = text;

        if (tree.firstChild instanceof HTMLElement
            && tree.firstChild.getAttribute('class') === 'mw-parser-output'
        ) {
            const output = tree.firstChild;

            if (output.childNodes.length === 1
                && output.firstChild instanceof HTMLElement
                && output.firstChild.tagName === 'P'
            ) {
                // Single child parser output
                html = output.firstChild.innerHTML;
            } else {
                // Multiple child output
                html = output.innerHTML;
            }
        }

        return message.channel.send(this.bot.fmt.codeBlock('html', html));
    }
}

module.exports = ParseCommand;
