const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

class IntegrationCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['integration', 'integrator', 'discord'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives installation instructions for DiscordIntegrator.`;
        this.desc = `Links to the instruction manual for DiscordIntegrator.`;
        this.usages = [
            '!integration'
        ];
    }

    call(message) {
        return message.channel.send(`
You can find the instructions for DiscordIntegrator installation here:
⟼ <https://dev.fandom.com/wiki/DiscordIntegrator/instructions>

If you have additional questions please post them in the <#246084444941844481> channel.
        `);
    }
}

module.exports = IntegrationCommand;
