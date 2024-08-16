import { Message } from 'discord.js';
import OPCommand from '../structs/OPCommand';
import Twinkle from '$src/Twinkle';

export default class QuitCommand extends OPCommand {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['quit', 'q', 'destroy', 'die'];

        this.shortdesc = `Kills the bot.`;
        this.desc = `
            Kills the bot, destroys the client, and stops execution.
            You need to be a bot operator to use this command.`;
        this.usages = [
            '!quit'
        ];
    }

    async call(message: Message) {
        await message.channel.send('Alright then');

        this.bot.cleanup();
    }
}
