const Filter = require('../structs/filter.js');

class MassMentionFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.USERS_PATTERN = /<@!?\d+>/g;
    }

    suppressMentions(text) {
        return text.replace(this.USERS_PATTERN, '');
    }

    interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        if (message.mentions.users.size < 6) return;

        return true;
    }

    async handle(message) {
        const muteAction = message.member.addRole('401231955741507604');

        const suppressed = this.suppressMentions(message.content);
        let deleted = !suppressed.trim();

        if (deleted) {
            message.delete();
        }

        let warning = `Hey! Please avoid mentioning so many people in ${message.guild.name}.`;

        if (deleted) {
            warning += `\n\nYour message has been deleted.`;
        }

        message.author.send(warning);

        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');
        (this.automod.logchan() || message.channel).send({
            embed: {
                author: {
                    name: `${message.author.username}#${message.author.discriminator} has been warned ${muteResult}`,
                    icon_url: message.author.displayAvatarURL
                },
                color: message.guild.me.displayColor,
                description: `**Reason**: Mass mention (${message.mentions.users.size} users)\n<@${message.author.id}>\n`, // TODO: # of offenses
            }
        });
    }
}

module.exports = MassMentionFilter;