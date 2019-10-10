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

        if (!suppressed.trim()) {
            message.delete();
        }

        message.channel.send({
            embed: {
                title: `${message.author.username}#${message.author.discriminator} has been warned`,
                color: message.guild.me.displayColor,
                description: `<@${message.author.id}>\nReason: Mass mention (${message.mentions.users.size})`, // TODO: # of offenses
                author: {
                    icon_url: message.author.displayAvatarURL
                }
            }
        });
    }
}

module.exports = MassMentionFilter;