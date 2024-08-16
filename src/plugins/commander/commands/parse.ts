import got from 'got';
import { SlashCommandBuilder } from '@discordjs/builders';
import { parse, HTMLElement } from 'node-html-parser';
import { Message } from 'discord.js';
import * as t from 'io-ts';

import Command from '../structs/Command';
import FandomizerPlugin from '../../fandomizer';
import FormatterPlugin from '../../fmt';
import Twinkle from '$src/Twinkle';
import { assert } from 'assertmin';

const ParseApiSchema = t.type({
    parse: t.type({
        text: t.type({
            '*': t.string
        })
    })
});

export default class ParseCommand extends Command {
    private fandomizer: FandomizerPlugin;
    private formatter: FormatterPlugin;

    constructor(bot: Twinkle) {
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

        this.fandomizer = bot.loadPlugin(FandomizerPlugin);
        this.formatter = bot.loadPlugin(FormatterPlugin);
    }

    async call(message: Message, content: string) {
        const wiki = 'dev'; // Hardcoded
        const url = await this.fandomizer.url(wiki);
        const result = await got(`${url}/api.php`, {
            searchParams: {
                action: 'parse',
                prop: 'text',
                text: content,
                disablepp: true,
                format: 'json'
            }
        }).json();
        assert(ParseApiSchema.is(result));

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

        return message.channel.send(this.formatter.codeBlock('html', html));
    }
}
