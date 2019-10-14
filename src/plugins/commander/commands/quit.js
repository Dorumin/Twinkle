const Command = require('../structs/command.js');

class QuitCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['quit', 'q', 'destroy', 'die'];
    }

    call(message) {
        await message.channel.send('Alright then');

        this.bot.client.destroy();
    }
}

module.exports = QuitCommand;