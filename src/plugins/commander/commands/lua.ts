import { SlashCommandBuilder } from '@discordjs/builders';
import { Message } from 'discord.js';
import { CommandCallExtraPayload } from '..';
import Command from '../structs/Command';
import Twinkle from '$src/Twinkle';

const LUA_ID = '269869890087682049';

export default class LuaRoleCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['lua', 'rmlua'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the Lua role.`;
        this.desc = `
            Gives you the Lua role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!lua'
        ];
    }

    async call(message: Message, content: string, { interaction }: CommandCallExtraPayload) {
        if (content) return;
        if (!message.member) return;

        const had = message.member.roles.cache.has(LUA_ID);
        if (had) {
            await message.member.roles.remove(LUA_ID);
        } else {
            await message.member.roles.add(LUA_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${LUA_ID}> role has been taken away`
                    : `You have been given the <@&${LUA_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}
