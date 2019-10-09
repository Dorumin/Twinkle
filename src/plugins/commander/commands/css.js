const Command = require('../structs/command.js');

class CSSRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['css'];
    }

    call(message) {
        message.delete();
        if (message.member.roles.has('269869854440423429')) {
            message.member.removeRole('269869854440423429');
        } else {
            message.member.addRole('269869854440423429');
        }
    }
}

module.exports = CSSRoleCommand;