const Command = require('../structs/command.js');

class AskCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['ask'];
    }

    call(message) {
        message.channel.send(`
Please don't ask if you may ask or ask for people who "know" x, y, or z. Just ask your question and somebody may be able to answer it.
<https://sol.gfxile.net/dontask.html>
        `)
    }
}

module.exports = AskCommand;