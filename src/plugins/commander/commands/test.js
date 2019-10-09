const OPCommand = require('../structs/opcommand.js');

class TestCommand extends OPCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['test'];
    }

    call(message) {
        message.channel.send('Tested!');
    }
}

module.exports = TestCommand;