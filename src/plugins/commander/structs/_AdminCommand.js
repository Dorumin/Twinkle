const Command = require('./_Command.js');

class AdminCommand extends Command {
    constructor(bot) {
        super(bot);
        this.priority = 2;
    }

    filter(message) {
        return this.isAdmin(message);
    }
}

module.exports = AdminCommand;