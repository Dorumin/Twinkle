const Command = require('../structs/Command.js');

class PortabilityCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['portability', 'rmportability'];

        this.shortdesc = `Gives you the Portability role.`;
        this.desc = `
            Gives you the Portability role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!portability'
        ];
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