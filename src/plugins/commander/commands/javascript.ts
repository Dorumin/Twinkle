import { SlashCommandBuilder } from '@discordjs/builders';
import { Message } from 'discord.js';
import Command from '../structs/Command';
import { CommandCallExtraPayload } from '..';
import Twinkle from '$src/Twinkle';

const JS_ID = '269869828691591169';

export default class JavaScriptCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['javascript', 'js', 'rmjavascript', 'rmjs'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the JavaScript role.`;
        this.desc = `
            Gives you the JavaScript role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!javascript'
        ];
    }

    async call(message: Message, content: string, { interaction }: CommandCallExtraPayload) {
        if (content) return;
        if (!message.member) return;

        const had = message.member.roles.cache.has(JS_ID);
        if (had) {
            await message.member.roles.remove(JS_ID);
        } else {
            await message.member.roles.add(JS_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${JS_ID}> role has been taken away`
                    : `You have been given the <@&${JS_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}
