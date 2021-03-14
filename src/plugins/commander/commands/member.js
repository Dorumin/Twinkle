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

    async getUserId(username) {
        const response = await got('https://dev.fandom.com/api.php', {
            searchParams: {
                action: 'query',
                list: 'users',
                ususers: username,
                format: 'json'
            }
        }).json();

        return response.query.users[0] && response.query.users[0].userid;
    }

    async getEditCount(userId) {
        const response = await got(`https://dev.fandom.com/wikia.php`, {
            searchParams: {
                controller: 'UserProfile',
                method: 'getUserData',
                userId: userId,
                format: 'json'
            }
        }).json()

        return response.userData.edits;
    }

    getMastheadDiscord(userId) {
        return got(`https://services.fandom.com/user-attribute/user/${userId}/attr/discordHandle`, {
            headers: {
                accept: '*/*'
            }
        }).json();
    }

    async call(message, content) {
        if (!content) {
            return message.channel.send('You need to specify a username.');
        }

        if (message.member.roles.cache.has('246302564625285121')) {
            return message.channel.send('You already have the role.');
        }

        const userId = await this.getUserId(content);

        if (!userId) {
            return message.channel.send('That user does not exist.');
        }

        const edits = await this.getEditCount(userId);

        if (edits < 1) {
            return message.channel.send('You do not have enough edits.');
        }

        const verifyUser = await this.getMastheadDiscord(userId);

        if (verifyUser.value !== message.author.tag) {
            return message.channel.send(`The username and tag in the masthead do not match the username and tag of the message author. Use <https://dev.fandom.com/wiki/Special:VerifyUser/${encodeURIComponent(content)}?user=${encodeURIComponent(message.author.username)}&tag=${message.author.discriminator}&c=!member&ch=lobby> to remedy this.`);
        }

        message.member.roles.add('246302564625285121');
        message.channel.send('Role has been added.');
    }
}

module.exports = MemberCommand;
