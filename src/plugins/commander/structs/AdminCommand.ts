import Command from './Command';
import Twinkle from '../../../Twinkle';
import { Message } from 'discord.js';

export default abstract class AdminCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.priority = 2;
    }

    filter(message: Message) {
        return this.isAdmin(message);
    }
}
