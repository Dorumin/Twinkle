const OPCommand = require('../structs/_OPCommand.js/index.js');

class TestCommand extends OPCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['test'];

        this.shortdesc = 'Replies.';
        this.desc = 'Replies with "Tested!", as to confirm the bot is, indeed, running.\nYou need to be an operator in order to use this command.';
        this.usages = [
            '!test'
        ];
    }

    call(message) {
        message.channel.send('Tested!');
    }
}

module.exports = TestCommand;