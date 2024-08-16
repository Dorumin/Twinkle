import * as t from 'io-ts';

import { ConfigProvider } from '$src/structs/Config';
import AutomodPlugin from '..';
import Cache from '../../../structs/Cache';
import Filter from '../structs/AutomodFilter';
import { Message, User } from 'discord.js';

const FloodConfigSchema = t.type({
    FLOOD: t.type({
        MIN: t.number,
        DELAY: t.number
    })
});

export default class FloodFilter extends Filter {
    private config: t.TypeOf<typeof FloodConfigSchema>['FLOOD'];
    // Mapping of user to channels posted to, with message and timeout to clear
    // Walk through to delete all spam messages, check size for spam breadth
    private userMap: Cache<string, Map<string, { message: Message, timeout: NodeJS.Timeout }>>;

    constructor(automod: AutomodPlugin, config: ConfigProvider) {
        super(automod, config);

        this.config = config.getOptionTyped('AUTOMOD', FloodConfigSchema).FLOOD;
        // this.min = this.config.MIN || 4;
        // this.delay = this.config.DELAY || 3000;

        this.userMap = new Cache();
    }

    interested(message: Message) {
        if (!message.member) return false;
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        const chanMap = this.userMap.get(message.author.id, () => new Map());

        if (!chanMap.has(message.channel.id)) {
            chanMap.set(message.channel.id, {
                message,
                timeout: setTimeout(() => {
                    chanMap.delete(message.channel.id);
                }, this.config.DELAY)
            });
        }

        return chanMap.size >= this.config.MIN;
    }

    async handle(message: Message) {
        if (!message.member || !message.guild) return;

        const channels = this.userMap.get(message.author.id);

        const muteAction = message.member.roles.add('401231955741507604');
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');
        for (const { message } of channels.values()) {
            await message.delete();
        }

        let logMessage = `**Reason**: Multi-channel flooding\n<@${message.author.id}>\nChannels posted in: ${channels.size}`;
        try {
            await message.author.send(`Hey! Please don't flood ${message.guild.name}.`);
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
                description: logMessage,
            }]
        });
    }
}
