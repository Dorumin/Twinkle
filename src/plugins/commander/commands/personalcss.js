const Command = require('../structs/command.js');

class PersonalCSSCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['personalcss', 'usercss'];
    }

    call(message) {
        message.channel.send(`
Personal CSS pages are located on
- <https://dev.fandom.com/wiki/Special:Mypage/common.css>
- <https://dev.fandom.com/wiki/Special:Mypage/chat.css> (for chat)
- <https://c.fandom.com/wiki/Special:Mypage/global.css> (for all wikis)
You can replace dev.fandom.com with your wiki's URL to install your CSS on that wiki.
        `);
    }
}

module.exports = PersonalCSSCommand;