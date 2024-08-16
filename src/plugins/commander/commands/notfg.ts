import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import { Message } from 'discord.js';
import Command from '../structs/Command';

export default class NotFandomCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['notfg', 'notfandom'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Dev is not F/G.`;
        this.desc = `Tells people to go to F/G.`;
    }

    async call(message: Message) {
        if (message.guild === null) return;

        await message.channel.send(`${message.guild.name} is not Fandom/Gamepedia. To complain about Fandom features and changes, you can find open ears at <https://discord.gg/fandom>`);
    }
}
