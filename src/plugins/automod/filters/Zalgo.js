const Filter = require('../structs/filter.js');

class ZalgoFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.min = automod.config.ZALGO.MIN || 10;
        this.zalgo = [768, 770, 771, 772, 773, 775, 776, 777, 778, 779, 780, 781, 782, 783, 784, 785, 786, 787, 788, 794, 801, 806, 814, 815, 819, 829, 830, 834, 835, 836, 838, 842, 843, 844, 848, 849, 850, 854, 855, 856, 859, 865, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 877, 878, 879, 1161];
    }

    interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        let i = message.content.length,
        min = this.min;

        while (i-- && min) {
            let code = message.content.charCodeAt(i);

            if (this.zalgo.includes(code)) {
                min--;
            }
        }

        return min === 0;
    }

    async handle(message) {
        const muteAction = message.member.addRole('401231955741507604');
        message.author.send(`Hey! Please don't abuse zalgo/spammy text in ${message.guild.name}.`); // TODO # of offenses
        message.delete();

        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');
        (this.automod.logchan() || message.channel).send({
            embed: {
                author: {
                    name: `${message.author.username}#${message.author.discriminator} has been warned ${muteResult}`,
                    icon_url: message.author.displayAvatarURL
                },
                color: message.guild.me.displayColor,
                description: `**Reason**: Zalgo usage\n<@${message.author.id}>`, // TODO: # of offenses
            }
        });
    }
}

module.exports = ZalgoFilter;