import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import { Message } from 'discord.js';
import Command from '../structs/Command';

export default class StaffCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['staff', 'sc'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Posts a link to the Zendesk contact form.`;
        this.desc = `Links to the Zendesk contact form.`;
    }

    async call(message: Message) {
        return message.channel.send(`You can contact Fandom Staff through the contact form at <https://support.fandom.com/hc/requests/new>.`);
    }
}
