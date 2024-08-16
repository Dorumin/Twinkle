import Plugin from '../../structs/Plugin';
import Cache from '../../structs/Cache';
import Twinkle from '../../Twinkle';
import { ConfigProvider } from '../../structs/Config';

export default class FormatterPlugin extends Plugin {
    tokens: Cache<string, RegExp>;
    ZWSP: string;
    REGEX_TOKEN_PATTERN: RegExp;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.tokens = new Cache();

        this.ZWSP = String.fromCharCode(8203);
        this.REGEX_TOKEN_PATTERN = /[.*+?^${}()|[\]\\]/g;
    }

    firstLine(str: string) {
        return str.trim().match(/^.*/)![0];
    }

    trimLines(str: string) {
        return str.trim().replace(/^\s+/gm, '');
    }

    indent(str: string, spaces: string | number = 2) {
        const prefix = typeof spaces === 'string'
            ? spaces
            : new Array(spaces + 1).join(' ');

        return prefix + str.replace(/\n/g, `\n${prefix}`);
    }

    escapeRegex(str: string) {
        return str.replace(this.REGEX_TOKEN_PATTERN, '\\$&');
    }

    anyTokens(chars: string, flags: string) {
        const uniq = Array.from(new Set(chars));
        const str = uniq.map(this.escapeRegex.bind(this)).join('|');

        return new RegExp(str, flags);
    }

    escape(str: string, chars: string, escapeToken = '\\', trailing = false) {
        const re = this.tokens.get(chars, () => this.anyTokens(chars, 'gi'));
        let replaced = str.replace(re, `${escapeToken}$&`);

        if (trailing && re.test(str.charAt(str.length - 1))) {
            replaced += escapeToken;
        }

        return replaced;
    }

    wrap(content: string, {
        wrap,
        escapeToken = '\\',
        trailing = false
    }: {
        wrap: string[] | string;
        escapeToken?: string;
        trailing?: boolean;
    }) {
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

    code(content: string) {
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

    italic(content: string) {
        return this.wrap(content, {
            wrap: '*'
        });
    }

    bold(content: string) {
        return this.wrap(content, {
            wrap: '**'
        });
    }

    strike(content: string) {
        return this.wrap(content, {
            wrap: '~~'
        });
    }

    underline(content: string) {
        return this.wrap(content, {
            wrap: '__'
        });
    }

    link(text: string, url: string) {
        if (!url) {
            return text;
        }

        return `[${text}](${url})`;
    }

    codeBlock(lang: string, content?: string) {
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
