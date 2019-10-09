const Command = require('../structs/command.js');

class RulesCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['rules'];
    }

    call(message) {
        message.channel.send(`
Rules of this server can be found in the <#246663167537709058> channel.
Fandom Community Guidelines - <https://c.fandom.com/wiki/Community_Guidelines>
Fandom Terms of Use - <https://fandom.com/terms-of-use>
Customization policy - <https://c.fandom.com/wiki/Help:Customization_policy>
Discord Community Guidelines - <https://dis.gd/guidelines>
Discord Terms of Use - <https://dis.gd/tos>
        `);
    }
}

module.exports = RulesCommand;