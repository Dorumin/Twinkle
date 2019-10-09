const Command = require('../structs/command.js');

class WikitextRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['wikitext'];
    }

    call(message) {
        message.delete();
        if (message.member.roles.has('269869867123867650')) {
            message.member.removeRole('269869867123867650');
        } else {
            message.member.addRole('269869867123867650');
        }
    }
}

module.exports = WikitextRoleCommand;