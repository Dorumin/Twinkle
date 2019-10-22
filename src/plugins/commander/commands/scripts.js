const Command = require('../structs/Command.js');

class ScriptsCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['scripts'];

        this.shortdesc = 'Posts a link to the JS enhancement index.';
        this.desc = 'Posts a link to the JavaScript enhancement page on dev wiki.';
        this.usages = [
            '!scripts'
        ];
    }

    call(message) {
        message.channel.send(`You can find a list of JavaScript enhancements on <https://dev.fandom.com/wiki/List_of_JavaScript_enhancements>`);
    }
}

module.exports = ScriptsCommand;