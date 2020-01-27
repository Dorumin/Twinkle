const Command = require('../structs/Command.js');

class LuaRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['lua', 'rmlua'];

        this.shortdesc = `Gives you the Lua role.`;
        this.desc = `
            Gives you the Lua role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!lua'
        ];
    }

    call(message, content) {
        if (content) return;

        message.delete();
        if (message.member.roles.has('269869890087682049')) {
            message.member.removeRole('269869890087682049');
        } else {
            message.member.addRole('269869890087682049');
        }
    }
}

module.exports = LuaRoleCommand;
