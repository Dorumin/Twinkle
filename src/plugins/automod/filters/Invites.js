const Filter = require('../structs/filter.js');

class InvitesFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.whitelist = automod.config.INVITES.WHITELIST;
    }

    matchInvites(text) {
        return text.match(/discord\.gg\/[\w\d]+/g);
    }

    interested(message) {
        const invites = this.matchInvites(message.content);
        if (!invites.length) return false;

        const invites = await Promise.all(invites.map(invite => message.client.fetchInvite(invite)));

        let i = invites.length;
        while (i--) {
            const invite = invites[i];
            if (
                invite.guild.id != message.guild.id &&
                !this.whitelist.includes(invite.guild.id)
            ) {
                return true;
            }
        }

        return false;
    }

    handle(message) {
        message.author.send(`Hey! Please don't link outside servers in ${message.guild.name}.`); // TODO # of offenses

        (this.automod.logchan() || message.channel).send({
            embed: {
                author: {
                    name: `${message.author.username}#${message.author.discriminator} has been warned`,
                    icon_url: message.author.displayAvatarURL
                },
                color: message.guild.me.displayColor,
                description: `**Reason**: Zalgo usage\n<@${message.author.id}>`, // TODO: # of offenses
            }
        });
    }
}

module.exports = InvitesFilter;