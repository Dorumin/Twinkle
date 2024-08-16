import * as t from 'io-ts';

import Filter from '../structs/AutomodFilter';
import AutomodPlugin from '..';
import { ConfigProvider } from '$src/structs/Config';
import { Message } from 'discord.js';

const InvitesConfigSchema = t.type({
    INVITES: t.type({
        WHITELIST: t.array(t.string)
    })
});

export default class InvitesFilter extends Filter {
    private config: t.TypeOf<typeof InvitesConfigSchema>['INVITES'];

    constructor(automod: AutomodPlugin, config: ConfigProvider) {
        super(automod, config);

        this.config = config.getOptionTyped('AUTOMOD', InvitesConfigSchema).INVITES;
        // this.whitelist = automod.config.INVITES.WHITELIST;
    }

    matchInvites(text: string) {
        return text.match(/discord(?:\.gg|(?:app)?\.com\/invite)\/([\w-]+)/g);
    }

    async interested(message: Message) {
        if (!message.member) return false;
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
                invite.guild?.id !== message.guild?.id &&
                !this.config.WHITELIST.includes(invite.guild?.id ?? '')
            ) {
                return true;
            }
        }

        return false;
    }

    async handle(message: Message) {
        if (!message.member || !message.guild) return;

        const muteAction = message.member.roles.add('401231955741507604');
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');

        await message.delete();

        let logMessage = `**Reason**: Posted invite\n<@${message.author.id}>\nContents: ${message.content.slice(0, 1800)}`; // TODO: # of offenses
        try {
            await message.author.send(`Hey! Please don't link outside servers in ${message.guild.name}.`); // TODO # of offenses
            await message.author.send(`Here's a copy of your message:\`\`\`${message.content.slice(0, 1900)}\`\`\``);
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 50007) {
                logMessage += '\nUser blocked DMs.';
            } else {
                await this.automod.getBot().reportError('Failed to warn user:', error);
                logMessage += '\nFailed to warn user.';
            }
        }

        await (await this.automod.logchan() || message.channel).send({
            embeds: [{
                author: {
                    name: `${message.author.tag} has been warned ${muteResult}`,
                    icon_url: message.author.displayAvatarURL()
                },
                color: message.guild.me?.displayColor,
                description: logMessage
            }]
        });
    }
}
