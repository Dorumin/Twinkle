const Filter = require('../structs/Filter.js');
const { MessageMentions } = require('discord.js');

class MassMentionFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.config = automod.config.MASSMENTION || {};
        this.minMentions = this.config.MINMENTIONS || 5;
        this.spanSeconds = this.config.SPANSECONDS || 10;
        this.cache = new Map();
    }

    suppressMentions(text) {
        return text.replace(MessageMentions.USERS_PATTERN, '');
    }

    interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        let previousCount = 0;

        if (this.cache.has(message.author.id)) {
            previousCount = this.cache.get(message.author.id);
        } else {
            previousCount = 0;
        }

        this.cache.set(message.author.id, previousCount + mentionCount);

        setTimeout(() => {
            if (!this.cache.has(message.author.id)) return;

            const previousCount = this.cache.get(message.author.id);

            this.cache.set(message.author.id, previousCount - mentionCount);

            if (previousCount - mentionCount <= 0) {
                this.cache.delete(message.author.id);
            }
        }, this.spanSeconds * 1000);

        if (this.cache.get(message.author.id) < this.minMentions) return;

        return true;
    }

    async handle(message) {
        const accumulated = this.cache.get(message.author.id);

        this.cache.delete(message.author.id);

        const muteAction = message.member.roles.add('401231955741507604');
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');

        // Suppressing and deleting mention-only messages seems counterproductive
        // to the whole ghost ping effort
        const suppressed = this.suppressMentions(message.content);
        let deleted = !suppressed.trim();

        if (deleted) {
            await message.delete();
        }

        let warning = `Hey! Please avoid mentioning so many people in ${message.guild.name}.`;

        if (deleted) {
            warning += `\n\nYour message has been deleted.`;
        }

        let logMessage = `**Reason**: Mass mention (${message.mentions.users.size} users, ${accumulated} accumulated)\n<@${message.author.id}>\n`; // TODO: # of offenses
        try {
            await message.author.send(warning);
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

module.exports = MassMentionFilter;
