const Command = require('../structs/Command.js');

class WikitextRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['wikitext', 'rmwikitext'];

        this.shortdesc = `Gives you the Wikitext role.`;
        this.desc = `
            Gives you the Wikitext role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!wikitext'
        ];
    }

    call(message, content) {
        if (content) return;

        message.delete();
        if (message.member.roles.cache.has('269869867123867650')) {
            message.member..roles.remove('269869867123867650');
        } else {
            message.member..roles.add('269869867123867650');
        }
    }
}

module.exports = WikitextRoleCommand;
