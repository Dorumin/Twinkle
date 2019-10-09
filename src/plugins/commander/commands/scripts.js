const Command = require('../structs/command.js');

class ScriptsCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['scripts'];
    }

    call(message) {
        message.channel.send(`You can find a list of JavaScript enhancements on <https://dev.fandom.com/wiki/List_of_JavaScript_enhancements>`);
    }
}

module.exports = ScriptsCommand;