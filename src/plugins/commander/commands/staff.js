const Command = require('../structs/Command.js');

class StaffCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['staff'];

        this.shortdesc = `Posts a link to Special:Contact.`;
        this.desc = `Links to Special:Contact on Community Central, if no wiki is provided.`;
        this.usages = [
            '!staff [wiki]'
        ];
        this.examples = [
            '!staff',
            '!staff c',
            '!staff doru',
        ];
    }

    async call(message, content) {
        let wiki = content || 'community',
        url = await this.bot.fandomizer.url(wiki);

        message.channel.send(`You can contact FANDOM Staff through the contact form on <https://${url}/wiki/Special:Contact/general>`);
    }
}

module.exports = StaffCommand;
