const Command = require('../structs/Command.js');

class PersonalCSSCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['personalcss', 'usercss'];

        this.shortdesc = `Lists links to personal CSS pages.`;
        this.desc = `
            Lists all links for personal CSS pages.
            If a wiki is provided, links will point to it. Otherwise, dev will be used.`;
        this.usages = [
            '!personalcss [wiki]'
        ];
        this.examples = [
            '!personalcss',
            '!personalcss c',
            '!personalcss doru',
        ];
    }

    async call(message, content) {
        let wiki = content || 'dev',
        url = await this.bot.fandomizer.url(wiki);

        message.channel.send(`
Personal CSS pages are located on
- <${url}/wiki/Special:Mypage/common.css>
- <${url}/wiki/Special:Mypage/chat.css> (for chat)
- <https://community.fandom.com/wiki/Special:Mypage/global.css> (for all wikis)
${content ? '' : `You can replace dev.fandom.com with your wiki's URL to install your CSS on that wiki.`}
        `);
    }
}

module.exports = PersonalCSSCommand;
