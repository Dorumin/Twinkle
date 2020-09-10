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

    call(message, content) {
        if (content) return;

        message.delete();
        if (message.member.roles.cache.has('311612168061714432')) {
            message.member..roles.remove('311612168061714432');
        } else {
            message.member..roles.add('311612168061714432');
        }
    }
}

module.exports = PortabilityCommand;
