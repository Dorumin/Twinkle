const Command = require('../structs/Command.js');

class JavaScriptCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['javascript', 'js'];

        this.shortdesc = 'Gives you the JavaScript role.';
        this.desc = 'Gives you the JavaScript role if you don\'t have it, or removes it if you do.\nDeletes your message afterwards.';
        this.usages = [
            '!javascript'
        ];
    }

    call(message) {
        message.delete();
        if (message.member.roles.has('269869828691591169')) {
            message.member.removeRole('269869828691591169');
        } else {
            message.member.addRole('269869828691591169');
        }
    }
}

module.exports = JavaScriptCommand;