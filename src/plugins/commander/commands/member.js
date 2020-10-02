const Command = require('../structs/Command.js');
const got = require('got');

class MembersCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['member', 'verify'];

        this.shortdesc = `Gives you the member role.`;
        this.desc = `Gives you the member role if don't already have it, requires one edit on dev.`;
        this.usages = [
            '!member wiki-username'
        ];
    }

    getEditCountAndID(username) {
        return got('https://dev.fandom.com/api.php', {
            searchParams: {
                action: 'query',
                list: 'users',
                usprop: 'editcount',
                ususers: username,
                format: 'json'
            }
        }).json();
    }

    getMastheadDiscord(userid) {
        return got(`https://services.fandom.com/user-attribute/user/${userid}/attr/discordHandle`).json();
    }

    async call(message, content) {
        if (!content) {
            return message.channel.send('You need to specify a username.');
        }

        if (message.member.roles.cache.has('246302564625285121')) {
            return message.channel.send('You already have the role.');
        }

        const editsAndID = await this.getEditCountAndID(content);

        if (!editsAndID.query.users[0]) {
            return message.channel.send('That user does not exist.');
        }

        if (editsAndID.query.users[0].editcount === 0) {
            return message.channel.send('You do not have enough edits.');
        }

        const verifyUser = await this.getMastheadDiscord(editsAndID.query.users[0].userid);

        if (verifyUser.value !== `${message.author.username}#${message.author.discriminator}`) {
            return message.channel.send('The username and tag in the masthead does not match the username and tag of the message author.');
        }

        message.member.roles.add('246302564625285121');
    }
}

module.exports = MembersCommand;
