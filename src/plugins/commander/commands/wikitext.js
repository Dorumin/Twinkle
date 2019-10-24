const Command = require('../structs/Command.js');

class WikitextRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['wikitext'];

        this.shortdesc = `Gives you the Wikitext role.`;
        this.desc = `
            Gives you the Wikitext role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!wikitext'
        ];
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