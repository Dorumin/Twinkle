import { SlashCommandBuilder } from '@discordjs/builders';
import Command from '../structs/Command';
import FormatterPlugin from '../../fmt';
import Twinkle from '$src/Twinkle';
import { Message } from 'discord.js';

export default class CodeCommand extends Command {
    private fmtPlugin: FormatterPlugin;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['code'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = 'Shows people how to give us code';
        this.desc = `
            Mentions a few good methods of giving us code, like pastebins and files.`;
        this.usages = [
            '!code'
        ];

        this.fmtPlugin = bot.loadPlugin(FormatterPlugin);
    }

    async call(message: Message) {
        await message.channel.send(`${this.fmtPlugin.bold('Give us your code!')} This makes debugging way easier.
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
