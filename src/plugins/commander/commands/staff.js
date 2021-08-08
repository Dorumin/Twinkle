const Command = require('../structs/Command.js');

class StaffCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['staff', 'sc'];

        this.shortdesc = `Posts a link to the Zendesk contact form.`;
        this.desc = `Links to the Zendesk contact form.`;
    }

    async call(message) {
        return message.channel.send(`You can contact Fandom Staff through the contact form at <https://fandom.zendesk.com/hc/requests/new>.`);
    }
}

module.exports = StaffCommand;
