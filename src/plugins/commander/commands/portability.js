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

    async call(message, content) {
        if (content) return;

        await message.delete();
        if (message.member.roles.cache.has('311612168061714432')) {
            return message.member.roles.remove('311612168061714432');
        } else {
            return message.member.roles.add('311612168061714432');
        }
    }
}

module.exports = PortabilityCommand;
