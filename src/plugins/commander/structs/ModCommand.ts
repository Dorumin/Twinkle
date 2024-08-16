import Command from './Command';
import Twinkle from '../../../Twinkle';
import { Message } from 'discord.js';

export default abstract class ModCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.priority = 1;
    }

    filter(message: Message) {
        return this.isModerator(message);
    }
}
