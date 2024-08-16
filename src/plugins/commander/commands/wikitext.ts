import { Message } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';
import { CommandCallExtraPayload } from '..';

const WIKITEXT_ID = '269869867123867650';

export default class WikitextRoleCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['wikitext', 'rmwikitext'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the Wikitext role.`;
        this.desc = `
            Gives you the Wikitext role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!wikitext'
        ];
    }

    async call(message: Message, content: string, { interaction }: CommandCallExtraPayload) {
        if (content) return;
        if (!message.member) return;

        const had = message.member.roles.cache.has(WIKITEXT_ID);
        if (had) {
            await message.member.roles.remove(WIKITEXT_ID);
        } else {
            await message.member.roles.add(WIKITEXT_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${WIKITEXT_ID}> role has been taken away`
                    : `You have been given the <@&${WIKITEXT_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}
