const Command = require('../structs/command.js');

class PortabilityCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['portability'];
    }

    call(message) {
        message.delete();
        if (message.member.roles.has('311612168061714432')) {
            message.member.removeRole('311612168061714432');
        } else {
            message.member.addRole('311612168061714432');
        }
    }
}

module.exports = PortabilityCommand;