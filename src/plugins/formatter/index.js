const Plugin = require('../../structs/Plugin.js');

class FormatterPlugin extends Plugin {
    load() {
        this.bot.fmt = new Formatter(this.bot);
    }
}

class Formatter {
    firstLine(str) {
        return str.trim().match(/^.*/);
    }

    trimLines(str) {
        return str.trim().replace(/^\s+/gm, '');
    }

    codeBlock(lang, content) {
        if (!content) {
            content = lang;
            lang = '';
        }

        return '```' + lang + '\n' + content + '```';
    }
}

module.exports = FormatterPlugin;