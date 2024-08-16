import { SlashCommandBuilder } from '@discordjs/builders';
import Command from '../structs/Command';
import Twinkle from '$src/Twinkle';
import { Message } from 'discord.js';
import { CommandCallExtraPayload } from '..';

const CSS_ID = '269869854440423429';

export default class CSSRoleCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['css', 'rmcss'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the CSS role.`;
        this.desc = `
                    Gives you the CSS role if you don't have it, or removes it if you do.
                    Deletes your message afterwards.`;
        this.usages = [
            '!css'
        ];
    }

    async call(message: Message, content: string, { interaction }: CommandCallExtraPayload) {
        if (content) return;
        if (!message.member) return;

        const had = message.member.roles.cache.has(CSS_ID);
        if (had) {
            await message.member.roles.remove(CSS_ID);
        } else {
            await message.member.roles.add(CSS_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${CSS_ID}> role has been taken away`
                    : `You have been given the <@&${CSS_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}
