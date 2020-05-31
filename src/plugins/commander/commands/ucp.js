const Command = require('../structs/Command.js');

class UCPCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['ucp'];

        this.shortdesc = `Posts a links to UCP info.`;
        this.desc = `Posts links to info about Fandom's UCP platform.`;
    }

    async call(message) {
        message.channel.send(`
- Help - <https://c.fandom.com/Help:UCP>
- Information - <https://fandom.zendesk.com/hc/articles/360044776693>
- Bugs, features, changes - <https://c.fandom.com/User:Noreplyz/UCP>
        `);
    }
}

module.exports = UCPCommand;
