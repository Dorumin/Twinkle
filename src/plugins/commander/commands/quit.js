const Command = require('../structs/command.js');

class QuitCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['quit', 'q', 'destroy', 'die'];

        this.shortdesc = 'Kills the bot.';
        this.desc = 'Kills the bot, destroys the client, and stops execution.\nYou need to be a bot operator to use this command.';
        this.usages = [
            '!quit'
        ];
    }

    async call(message) {
        await message.channel.send('Alright then');

        this.bot.client.destroy();
    }
}

module.exports = QuitCommand;