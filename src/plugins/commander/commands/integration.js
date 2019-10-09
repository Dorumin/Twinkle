const Command = require('../structs/command.js');

class IntegrationCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['integration', 'integrator', 'discord'];
    }

    call(message) {
        message.channel.send(`
You can find the instructions for DiscordIntegrator installation here:
⟼ <https://dev.fandom.com/wiki/DiscordIntegrator/instructions>

If you have additional questions please post them in the <#246084444941844481> channel.
        `);
    }
}

module.exports = IntegrationCommand;