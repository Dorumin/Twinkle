const Filter = require('../structs/Filter.js');

// Another fake filter that listens to message edits and deletes
// If they're from a new, suspect user on the guild, and mentions
// were removed from the old version to the new version, ground time
class GhostPingFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.config = automod.config.GHOSTPING || {};
        // Minimum mentions until a suspect user is banned from removing in one action
        this.minimumMentions = this.config.MINIMUM_MENTIONS || 1;
        // 30 days maximum age for being autogrounded
        this.maximumAge = this.config.MAX_AGE || 30 * 24 * 60 * 60 * 1000;
        this.roleId = this.config.MUTE_ROLE_ID || '401231955741507604';

        automod.bot.listen('messageDelete', this.onMessageDelete, this);
        automod.bot.listen('messageUpdate', this.onMessageUpdate, this);
    }

    interested(message) {
        return false;
    }

    handle() {}

    onMessageDelete(message) {
        let removedMentions = message.mentions.users.size + message.mentions.roles.size;

        if (removedMentions >= this.minimumMentions) {
            this.onMessageRemovedMentions(message);
        }
    }

    onMessageUpdate(oldMessage, newMessage) {
        let removedMentions = 0;
        removedMentions += oldMessage.mentions.users.filter(user => !newMessage.mentions.users.has(user.id)).size;
        removedMentions += oldMessage.mentions.roles.filter(role => !newMessage.mentions.roles.has(role.id)).size;

        if (removedMentions >= this.minimumMentions) {
            this.onMessageRemovedMentions(newMessage);
        }
    }

    async onMessageRemovedMentions(message) {
        if (!message.member) return;

        const msSinceJoined = Date.now() - message.member.joinedAt.getTime();
        if (msSinceJoined > this.maximumAge) return;

        const muteAction = message.member.roles.add(this.roleId);
        const muteResult = await (muteAction.then(() => 'and muted', () => 'but could not be muted'));

        let logMessage = `**Reason**: Ghost ping\n<@${message.author.id}>\nContents: ${message.content.slice(0, 1800)}`;

        try {
            await message.author.send(`Hey! Please don't ghost ping in ${message.guild.name}.`);
            await message.author.send(`Here's a copy of your message:\`\`\`${message.content.slice(0, 1900)}\`\`\``);
        } catch (error) {
            if (error && error.code === 50007) {
                logMessage += '\nUser blocked DMs.';
            } else {
                await this.automod.bot.reportError('Failed to warn user:', error);
                logMessage += '\nFailed to warn user.';
            }
        }

        await (await this.automod.logchan() || message.channel).send({
            embeds: [{
                author: {
                    name: `${message.author.tag} has been warned ${muteResult}`,
                    icon_url: message.author.displayAvatarURL()
                },
                color: message.guild.me.displayColor,
                description: logMessage
            }]
        });
    }
}

module.exports = GhostPingFilter;
