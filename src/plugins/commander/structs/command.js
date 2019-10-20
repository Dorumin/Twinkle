class Command {
    constructor(bot) {
        this.bot = bot;
        this.priority = 0;
        this.aliases = [];
    }

    static get deps() {
        return [];
    }

    isOperator(message) {
        return this.bot.config.OPERATORS.includes(message.author.id);
    }

    isModerator(message) {
        return message.member.hasPermission('MANAGE_MESSAGES');
    }

    isAdmin(message) {
        return message.member.hasPermission('ADMINISTRATOR');
    }

    wait(ms, val) {
        return new Promise(res => setTimeout(res.bind(this, val), ms));
    }

    async react(message, ...emojis) {
        for (let i = 0; i < emojis.length; i++) {
            await message.react(emojis[i]);
        }
    }

    async clearReactions(message) {
        try {
            await message.clearReactions();
        } catch(e) {
            await this.removeOwnReactions(message);
        }
    }

    async removeOwnReactions(message) {
        return Promise.all(
            message.reactions
                .filter(reaction => reaction.me)
                .map(reaction => reaction.remove())
        );
    }

    filter() {
        return true;
    }

    call() {
        throw new Error('call() not implemented');
    }
}

module.exports = Command;