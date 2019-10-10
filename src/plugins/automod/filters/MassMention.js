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
        // if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        if (message.mentions.users.size < 6) return;

        return true;
    }

    handle(message) {
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

        this.automod.logchan.send({
            embed: {
                title: `${message.author.username}#${message.author.discriminator} has been warned`,
                color: message.guild.me.displayColor,
                description: `<@${message.author.id}>\nReason: Mass mention (${message.mentions.users.size} users)`, // TODO: # of offenses
                author: {
                    icon_url: message.author.displayAvatarURL
                }
            }
        });
    }
}

module.exports = MassMentionFilter;