const Command = require('../structs/command.js');

class PersonalCSSCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['personalcss', 'usercss'];
    }

    async call(message, content) {
        let wiki = content || 'dev',
        url = await this.bot.fandomizer.url(wiki);

        message.channel.send(`
Personal CSS pages are located on
- <${url}/wiki/Special:Mypage/common.css>
- <${url}/wiki/Special:Mypage/chat.css> (for chat)
- <https://c.fandom.com/wiki/Special:Mypage/global.css> (for all wikis)
${content ? '' : `You can replace dev.fandom.com with your wiki's URL to install your CSS on that wiki.`}
        `);
    }
}

module.exports = PersonalCSSCommand;