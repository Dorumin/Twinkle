const Command = require('../structs/command.js');

class JavaScriptCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['javascript', 'js'];
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