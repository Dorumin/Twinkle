import Twinkle from '$src/Twinkle';
import { Message } from 'discord.js';
import OPCommand from '../structs/OPCommand';

export default class TestCommand extends OPCommand {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['test'];

        this.shortdesc = `Replies.`;
        this.desc = `
            Replies with "Tested!", as to confirm the bot is, indeed, running.
            You need to be an operator in order to use this command.`;
        this.usages = [
            '!test'
        ];
    }

    call(message: Message) {
        return message.channel.send('Tested!');
    }
}
