class Command {
    constructor(bot) {
        this.bot = bot;
        this.priority = 0;
        this.aliases = [];
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

    wait(ms) {
        return new Promise(res => setTimeout(res, ms));
    }
    
    filter() {
        return true;
    }

    call() {
        throw new Error('call() not implemented');
    }
}

module.exports = Command;