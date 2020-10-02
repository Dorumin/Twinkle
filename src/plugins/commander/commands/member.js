const Command = require('../structs/Command.js');
const got = require('got');

class MemberCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['member', 'verify'];

        this.shortdesc = `Gives you the member role.`;
        this.desc = `Gives you the member role if don't already have it, requires one edit on dev.`;
        this.usages = [
            '!member wiki-username'
        ];
    }

    call(message, content) {
        if (content) return;
        
        var edits = await got('https://dev.fandom.com/api.php', {
            searchParams: {
                action: 'query',
                list: 'users',
                usprop: 'editcount',
                ususers: content,
                format: 'json'
            }
        }).json();
        
        if (edits.query.users[0]) {
            if (edits.query.users[0].editcount >= 1) {
                if (message.member.roles.cache.has('246302564625285121')) {
                    message.member.roles.add('246302564625285121');
                } else {
                    message.channel.send('You already have the role.');
                }
            } else {
                message.channel.send('You do not have enough edits.');
            }
        } else {
            message.channel.send('That user does not exist.');
        }
    }
}

module.exports = JavaScriptCommand;
