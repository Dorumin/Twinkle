const Plugin = require('../../structs/Plugin.js');
const Cache = require('../../structs/Cache.js')

class FormatterPlugin extends Plugin {
    load() {
        this.bot.fmt = new Formatter();
    }
}

class Formatter {
    constructor() {
        this.tokens = new Cache();

        this.ZWSP = String.fromCharCode(8203);
        this.REGEX_TOKEN_PATTERN = /[.*+?^${}()|[\]\\]/g;
    }

    firstLine(str) {
        return str.trim().match(/^.*/)[0];
    }

    trimLines(str) {
        return str.trim().replace(/^\s+/gm, '');
    }

    indent(str, spaces = 2) {
        const prefix = typeof spaces === 'string'
            ? spaces
            : new Array(spaces + 1).join(' ');

        return prefix + str.replace(/\n/g, `\n${prefix}`);
    }

    escapeRegex(str) {
        return str.replace(this.REGEX_TOKEN_PATTERN, '\\$&');
    }

    anyTokens(chars, flags) {
        const uniq = Array.from(new Set(chars));
        const str = uniq.map(this.escapeRegex.bind(this)).join('|');

        return new RegExp(str, flags);
    }

    escape(str, chars, escapeToken = '\\', trailing = false) {
        const re = this.tokens.get(chars, () => this.anyTokens(chars, 'gi'));
        let replaced = str.replace(re, `${escapeToken}$&`);

        if (trailing && re.test(str.charAt(str.length - 1))) {
            replaced += escapeToken;
        }

        return replaced;
    }

    wrap(content, { wrap, escapeToken = '\\', trailing = false }) {
        let chars;
        let surround;

        if (Array.isArray(wrap)) {
            chars = wrap.join('');
            surround = wrap;
        } else {
            chars = wrap;
            surround = [wrap];
        }

        let str = '';
        for (let i = 0; i < surround.length; i++) {
            str += surround[i];
        }

        str += this.escape(content, chars, escapeToken, trailing);

        let i = surround.length;
        while (i--) {
            str += surround[i];
        }

        return str;
    }

    code(content) {
        if (content.includes('`')) {
            return this.wrap(content, {
                wrap: '``',
                escapeToken: this.ZWSP,
                trailing: true
            });
        } else {
            return this.wrap(content, {
                wrap: '`',
                escapeToken: this.ZWSP
            });
        }
    }

    italic(content) {
        return this.wrap(content, {
            wrap: '*'
        });
    }

    bold(content) {
        return this.wrap(content, {
            wrap: '**'
        });
    }

    strike(content) {
        return this.wrap(content, {
            wrap: '~~'
        });
    }

    underline(content) {
        return this.wrap(content, {
            wrap: '__'
        });
    }

    link(text, url) {
        if (!url) {
            return text;
        }

        return `[${text}](${url})`;
    }

    codeBlock(lang, content) {
        if (!content) {
            content = lang;
            lang = '';
        }

        return this.wrap(`${lang}\n${String(content).trimEnd()}\n`, {
            wrap: '```',
            escapeToken: this.ZWSP
        });
    }
}

module.exports = FormatterPlugin;
