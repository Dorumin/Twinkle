const Command = require('../structs/command.js');

class PersonalJSCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['personaljs', 'userjs'];
    }

    call(message) {
        message.channel.send(`
Personal JavaScript pages are located on
- <https://dev.fandom.com/wiki/Special:Mypage/common.js>
- <https://dev.fandom.com/wiki/Special:Mypage/chat.js> (for chat)
- <https://c.fandom.com/wiki/Special:Mypage/global.js> (for all wikis)
You can replace dev.fandom with your wiki's URL to install your JavaScript on that wiki.

To enable personal JavaScript, go to <https://c.fandom.com/wiki/Special:Preferences>, in the Under the Hood section and search for "Enable personal JavaScript" option, check it and save your preferences.
        `);
    }
}

module.exports = PersonalJSCommand;