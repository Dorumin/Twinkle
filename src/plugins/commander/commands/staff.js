const Command = require('../structs/command.js');

class StaffCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['staff'];
    }

    call(message) {
        message.channel.send(`You can contact FANDOM Staff through the contact form on <https://c.fandom.com/wiki/Special:Contact/general>`);
    }
}

module.exports = StaffCommand;