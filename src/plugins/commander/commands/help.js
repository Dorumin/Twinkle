const Command = require('../structs/command.js');

class HelpCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['help', 'commands'];
    }

    call({ author }) {
        const commands = this.bot.commander.commands.values();
        let help = 'Here are all the commands:```';

        for (const command of commands) {
            const [name, ...rest] = command.aliases;
            let line = `!${name}`;
            if (rest.length) {
                line += ` (aliases: ${rest.join(', ')})`;
            }

            help += '\n' + line;
        }

        help += '```';

        author.send(help);
    }
}

module.exports = HelpCommand;