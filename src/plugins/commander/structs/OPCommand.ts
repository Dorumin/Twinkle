import Command from './Command';
import Twinkle from '../../../Twinkle';
import { Message } from 'discord.js';

export default abstract class OPCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.priority = 4;
    }

    filter(message: Message) {
        return this.isOperator(message);
    }
}
