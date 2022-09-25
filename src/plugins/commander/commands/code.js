const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');
const FormatterPlugin = require('../../fmt');

class CodeCommand extends Command {
    static get deps() {
        return [
            FormatterPlugin
        ];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['code'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = 'Shows people how to give us code';
        this.desc = `
            Mentions a few good methods of giving us code, like pastebins and files.`;
        this.usages = [
            '!code'
        ];
    }

    async call(message) {
        await message.channel.send(`${this.bot.fmt.bold('Give us your code!')} This makes debugging way easier.
You can use:
 - codeblocks:
\\\`\\\`\\\`lang
// short block of code
\\\`\\\`\\\`
 - a link to your Fandom/GitHub file
 - a code snippet site:
<https://dpaste.org/> • <https://privatebin.net/> • <https://pst.klgrth.io/> • <https://hastebin.com/> • <https://gist.github.com/>
 - save your code as a file and upload it here
Please *don't* use screenshots, we can't read those!`);
    }
}

module.exports = CodeCommand;
