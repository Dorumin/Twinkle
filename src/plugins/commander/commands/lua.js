const Command = require('../structs/command.js');

class LuaRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['lua'];

        this.shortdesc = 'Gives you the Lua role.';
        this.desc = 'Gives you the Lua role if you don\'t have it, or removes it if you do.\nDeletes your message afterwards.';
        this.usages = [
            '!lua'
        ];
    }

    call(message) {
        message.delete();
        if (message.member.roles.has('269869890087682049')) {
            message.member.removeRole('269869890087682049');
        } else {
            message.member.addRole('269869890087682049');
        }
    }
}

module.exports = LuaRoleCommand;