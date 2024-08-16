import * as t from 'io-ts';

import { ConfigProvider } from '$src/structs/Config';
import AutomodPlugin from '..';
import AutomodFilter from '../structs/AutomodFilter';
import { Message } from 'discord.js';

const GhostPingConfigSchema = t.type({
    GHOSTPING: t.type({
        MINIMUM_MENTIONS: t.number,
        MAX_AGE: t.number,
        MUTE_ROLE_ID: t.string
    })
});

// Another fake filter that listens to message edits and deletes
// If they're from a new, suspect user on the guild, and mentions
// were removed from the old version to the new version, ground time
export default class GhostPingFilter extends AutomodFilter {
    config: t.TypeOf<typeof GhostPingConfigSchema>['GHOSTPING'];

    constructor(automod: AutomodPlugin, config: ConfigProvider) {
        super(automod, config);

        this.config = config.getOptionTyped('AUTOMOD', GhostPingConfigSchema).GHOSTPING;

        // // Minimum mentions until a suspect user is banned from removing in one action
        // this.minimumMentions = this.config.MINIMUM_MENTIONS || 1;
        // // 30 days maximum age for being autogrounded
        // this.maximumAge = this.config.MAX_AGE || 30 * 24 * 60 * 60 * 1000;
        // this.roleId = this.config.MUTE_ROLE_ID || '401231955741507604';

        automod.getBot().listen('messageDelete', this.onMessageDelete, this);
        automod.getBot().listen('messageUpdate', this.onMessageUpdate, this);
    }

    interested(message: Message) {
        return false;
    }

    handle() {}

    onMessageDelete(message: Message) {
        let removedMentions = message.mentions.users.size + message.mentions.roles.size;

        if (removedMentions >= this.config.MINIMUM_MENTIONS) {
            this.onMessageRemovedMentions(message);
        }
    }

    onMessageUpdate(oldMessage: Message, newMessage: Message) {
        let removedMentions = 0;
        removedMentions += oldMessage.mentions.users.filter(user => !newMessage.mentions.users.has(user.id)).size;
        removedMentions += oldMessage.mentions.roles.filter(role => !newMessage.mentions.roles.has(role.id)).size;

        if (removedMentions >= this.config.MINIMUM_MENTIONS) {
            this.onMessageRemovedMentions(newMessage);
        }
    }

    async onMessageRemovedMentions(message: Message) {
        if (!message.guild || !message.member || !message.member.joinedAt) return;

        const msSinceJoined = Date.now() - message.member.joinedAt.getTime();
        if (msSinceJoined > this.config.MAX_AGE) return;

        const muteAction = message.member.roles.add(this.config.MUTE_ROLE_ID);
        const muteResult = await (muteAction.then(() => 'and muted', () => 'but could not be muted'));

        let logMessage = `**Reason**: Ghost ping\n<@${message.author.id}>\nContents: ${message.content.slice(0, 1800)}`;

        try {
            await message.author.send(`Hey! Please don't ghost ping in ${message.guild.name}.`);
            await message.author.send(`Here's a copy of your message:\`\`\`${message.content.slice(0, 1900)}\`\`\``);
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 50007) {
                logMessage += '\nUser blocked DMs.';
            } else {
                await this.automod.getBot().reportError('Failed to warn user:', error);
                logMessage += '\nFailed to warn user.';
            }
        }

        await (await this.automod.logchan())?.send({
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
