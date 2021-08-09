const Cache = require('../../../structs/Cache.js');
const Filter = require('../structs/Filter.js');

class FloodFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.config = automod.config.FLOOD || {};
        this.min = this.config.MIN || 4;
        this.delay = this.config.DELAY || 3000;
        this.userMap = new Cache();

        this.muted = new Set();
    }

    interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        const chanMap = this.userMap.get(message.author.id, () => new Map());

        if (!chanMap.has(message.channel.id)) {
            chanMap.set(message.channel.id, {
                message,
                timeout: setTimeout(() => {
                    chanMap.delete(message.channel.id);
                }, this.delay)
            });
        }

        if (this.muted.has(message.author.id)) return false;

        return chanMap.size >= this.min;
    }

    async handle(message) {
        this.muted.add(message.author.id);

        const muteAction = message.member.roles.add('401231955741507604');
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');
        for (const { message } of channels.values()) {
            await message.delete();
        }

        let logMessage = `**Reason**: Multi-channel flooding\n<@${message.author.id}>\nChannels posted in: ${channels.size}`;
        try {
            await message.author.send(`Hey! Please don't flood ${message.guild.name}.`);
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
                description: logMessage,
            }]
        });

        const channels = this.userMap.get(message.author.id);

        this.muted.delete(message.author.id);
    }
}

module.exports = FloodFilter;
