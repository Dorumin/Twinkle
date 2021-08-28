const Filter = require('../structs/Filter.js');

class InvitesFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.whitelist = automod.config.INVITES.WHITELIST;
    }

    matchInvites(text) {
        return text.match(/discord(app)?\.(gg|com\/invite)\/[\w-]+/g);
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
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');

        await message.delete();

        let logMessage = `**Reason**: Posted invite\n<@${message.author.id}>\nContents: ${message.content.slice(0, 1800)}`; // TODO: # of offenses
        try {
            await message.author.send(`Hey! Please don't link outside servers in ${message.guild.name}.`); // TODO # of offenses
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

module.exports = InvitesFilter;
