const Plugin = require('../../structs/Plugin.js');
const Cache = require('../../structs/Cache.js')

class FormatterPlugin extends Plugin {
    load() {
        this.bot.fmt = new Formatter(this.bot);
    }
}

class Formatter {
    constructor() {
        this.tokens = new Cache();
        this.REGEX_TOKEN_PATTERN = /[.*+?^${}()|[\]\\]/g;
    }

    firstLine(str) {
        return str.trim().match(/^.*/);
    }

    trimLines(str) {
        return str.trim().replace(/^\s+/gm, '');
    }

    escapeRegex(str) {
        return str.replace(this.REGEX_TOKEN_PATTERN, '\\$&');
    }

    anyTokens(chars, flags) {
        const uniq = Array.from(new Set(chars));
        const str = uniq.map(this.escapeRegex.bind(this)).join('|');
        return new RegExp(str, flags);
    }

    escape(str, chars, escapeToken = '\\') {
        const re = this.tokens.get(chars, () => this.anyTokens(chars, 'gi'));
        return str.replace(re, `${escapeToken}$&`);
    }

    sugar(content, ...flags) {
        let chars;

        if (flags[0] instanceof Array) {
            chars += flags.shift().join('');
        }

        chars += flags.join('');

        let str = '';
        for (let i = 0; i < flags.length; i++) {
            str += flags[i];
        }

        str += this.escape(content, chars);

        let i = flags.length;
        while (i--) {
            str += flags[i];
        }

        return str;
    }

    code(content) {
        return this.sugar(content, '`')
    }

    italic(content) {
        return this.sugar(content, '*');
    }

    bold(content) {
        return this.sugar(content, '**');
    }

    codeBlock(lang, content) {
        if (!content) {
            content = lang;
            lang = '';
        }

        return this.sugar(`${lang}\n${content}`, '```');
    }
}

module.exports = FormatterPlugin;