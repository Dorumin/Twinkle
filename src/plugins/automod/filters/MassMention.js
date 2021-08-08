const Filter = require('../structs/Filter.js');
const {MessageMentions} = require('discord.js');

class MassMentionFilter extends Filter {
    suppressMentions(text) {
        return text.replace(MessageMentions.USERS_PATTERN, '');
    }

    interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        if (message.mentions.users.size < 6) return;

        return true;
    }

    async handle(message) {
        const muteAction = message.member.roles.add('401231955741507604');
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');

        const suppressed = this.suppressMentions(message.content);
        let deleted = !suppressed.trim();

        if (deleted) {
            await message.delete();
        }

        let warning = `Hey! Please avoid mentioning so many people in ${message.guild.name}.`;

        if (deleted) {
            warning += `\n\nYour message has been deleted.`;
        }

        let logMessage = `**Reason**: Mass mention (${message.mentions.users.size} users)\n<@${message.author.id}>\n`; // TODO: # of offenses
        try {
            await message.author.send(warning);
        } catch (error) {
            if (error && error.code === 50007) {
                logMessage += '\nUser blocked DMs.';
            } else {
                console.error('Failed to warn user:', error);
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

module.exports = MassMentionFilter;
