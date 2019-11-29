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
        return message.guild && message.member.hasPermission('MANAGE_MESSAGES');
    }

    isAdmin(message) {
        return message.guild && message.member.hasPermission('ADMINISTRATOR');
    }

    wait(ms, val) {
        return new Promise(res => setTimeout(res.bind(this, val), ms));
    }

    filter() {
        return true;
    }

    call() {
        throw new Error('call() not implemented');
    }
}

module.exports = Command;
