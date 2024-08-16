import { SlashCommandBuilder } from '@discordjs/builders';
import { Message } from 'discord.js';
import { CommandCallExtraPayload } from '..';
import Command from '../structs/Command';
import Twinkle from '$src/Twinkle';

const PORTABILITY_ID = '311612168061714432';

export default class PortabilityCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['portability', 'rmportability'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the Portability role.`;
        this.desc = `
            Gives you the Portability role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!portability'
        ];
    }

    async call(message: Message, content: string, { interaction }: CommandCallExtraPayload) {
        if (content) return;
        if (!message.member) return;

        const had = message.member.roles.cache.has(PORTABILITY_ID);
        if (had) {
            await message.member.roles.remove(PORTABILITY_ID);
        } else {
            await message.member.roles.add(PORTABILITY_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${PORTABILITY_ID}> role has been taken away`
                    : `You have been given the <@&${PORTABILITY_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}
