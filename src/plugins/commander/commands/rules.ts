import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';
import { Message } from 'discord.js';

export default class RulesCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['rules', 'regulations'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Links various regulation pages you should follow.`;
        this.desc = `
            Lists various regulation pages you should follow.
            Includes the info channel, Fandom community guidelines and Terms of Use, and Discord community guidelines and Terms of Use`;
        this.usages = [
            '!rules'
        ];
    }

    call(message: Message) {
        return message.channel.send(`
Rules of this server can be found in the <#246663167537709058> channel.
Fandom Community Guidelines - <https://c.fandom.com/wiki/Community_Guidelines>
Fandom Terms of Use - <https://fandom.com/terms-of-use>
Customization policy - <https://c.fandom.com/wiki/Help:Customization_policy>
Discord Community Guidelines - <https://dis.gd/guidelines>
Discord Terms of Use - <https://dis.gd/tos>
        `);
    }
}
