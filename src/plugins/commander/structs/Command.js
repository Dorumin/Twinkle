class Command {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });

        this.aliases = [];
        this.priority = 0;
    }

    static get deps() {
        return [];
    }

    isOperator(message) {
        return this.bot.config.OPERATORS.includes(message.author.id);
    }

    isModerator(message) {
        return this.isOperator(message) || message.guild && message.channel.permissionsFor(message.member.user).any('MANAGE_MESSAGES');
    }

    isAdmin(message) {
        return this.isOperator(message) || message.guild && message.member.permissions.has('ADMINISTRATOR');
    }

    filter() {
        return true;
    }

    call() {
        throw new Error('call() not implemented');
    }

    cleanup() {}
}

module.exports = Command;
