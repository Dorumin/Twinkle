const Command = require('./command.js');

class ModCommand extends Command {
    constructor(bot) {
        super(bot);
        this.priority = 4;
    }
    
    filter(message) {
        return this.isOperator(message);
    }
}

module.exports = ModCommand;