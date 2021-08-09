const Command = require('../structs/Command.js');

class JavaScriptCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['javascript', 'js', 'rmjavascript', 'rmjs'];

        this.shortdesc = `Gives you the JavaScript role.`;
        this.desc = `
            Gives you the JavaScript role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!javascript'
        ];
    }

    async call(message, content) {
        if (content) return;

        await message.delete();
        if (message.member.roles.cache.has('269869828691591169')) {
            return message.member.roles.remove('269869828691591169');
        } else {
            return message.member.roles.add('269869828691591169');
        }
    }
}

module.exports = JavaScriptCommand;
