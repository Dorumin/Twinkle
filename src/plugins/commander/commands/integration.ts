import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import { Message } from 'discord.js';
import Command from '../structs/Command';

export default class IntegrationCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['integration', 'integrator', 'discord'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives installation instructions for DiscordIntegrator.`;
        this.desc = `Links to the instruction manual for DiscordIntegrator.`;
        this.usages = [
            '!integration'
        ];
    }

    call(message: Message) {
        return message.channel.send(`
You can find the instructions for DiscordIntegrator installation here:
⟼ <https://dev.fandom.com/wiki/DiscordIntegrator/instructions>

If you have additional questions please post them in the <#246084444941844481> channel.
        `);
    }
}
