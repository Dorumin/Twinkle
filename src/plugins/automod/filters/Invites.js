const Filter = require('../structs/Filter.js');

class InvitesFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.whitelist = automod.config.INVITES.WHITELIST;
    }

    matchInvites(text) {
        return text.match(/discord\.gg\/\w+/g);
    }

    async interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        const inviteCodes = this.matchInvites(message.content);
        if (!inviteCodes) return false;

        let invites;
        try {
            invites = await Promise.all(inviteCodes.map(invite => message.client.fetchInvite(invite)));
        } catch(e) {
            return false;
        }

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

    async handle(message) {
        const muteAction = message.member.roles.add('401231955741507604');
        message.author.send(`Hey! Please don't link outside servers in ${message.guild.name}.`); // TODO # of offenses
        message.author.send(`Here's a copy of your message:\`\`\`${message.content}\`\`\``);
        message.delete();

        // const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');
        (await this.automod.logchan() || message.channel).send({
            embed: {
                author: {
                    name: `${message.author.username}#${message.author.discriminator} has been warned`,
                    icon_url: message.author.displayAvatarURL()
                },
                color: message.guild.me.displayColor,
                description: `**Reason**: Posted invite\n<@${message.author.id}>`, // TODO: # of offenses
            }
        });
    }
}

module.exports = InvitesFilter;
