const Filter = require('../structs/Filter.js');

class ZalgoFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.min = automod.config.ZALGO.MIN || 10;
        this.zalgo = [768, 770, 771, 772, 773, 775, 776, 777, 778, 779, 780, 781, 782, 783, 784, 785, 786, 787, 788, 794, 801, 806, 814, 815, 819, 820, 821, 822, 823, 824, 829, 830, 834, 835, 836, 838, 842, 843, 844, 848, 849, 850, 854, 855, 856, 859, 865, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 877, 878, 879, 1161];
    }

    interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        let i = message.content.length;
        let min = this.min;

        while (i-- && min) {
            let code = message.content.charCodeAt(i);

            if (this.zalgo.includes(code)) {
                min--;
            }
        }

        return min === 0;
    }

    async handle(message) {
        const muteAction = message.member.roles.add('401231955741507604');
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');

        await message.delete();

        let logMessage = `**Reason**: Zalgo usage\n<@${message.author.id}>`; // TODO: # of offenses
        try {
            await message.author.send(`Hey! Please don't abuse zalgo/spammy text in ${message.guild.name}.`); // TODO # of offenses
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

module.exports = ZalgoFilter;
