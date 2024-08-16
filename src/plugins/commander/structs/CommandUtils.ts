import { EmojiIdentifierResolvable, Message } from 'discord.js';

export default class CommandUtils {
    static async react(message: Message, ...emojis: EmojiIdentifierResolvable[]) {
        for (let i = 0; i < emojis.length; i++) {
            await message.react(emojis[i]);
        }
    }

    static async clearReactions(message: Message) {
        try {
            await message.reactions.removeAll();
        } catch(e) {
            await this.removeOwnReactions(message);
        }
    }

    static async removeOwnReactions(message: Message) {
        return Promise.all(
            message.reactions.cache
                .filter(reaction => reaction.me)
                .map(reaction => reaction.remove())
        );
    }
}
