const { spawn } = require('child_process');
const OPCommand = require('../structs/opcommand.js');

class RestartCommand extends OPCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['restart', 'r'];
        this.hidden = true;
    }

    async call(message, content) {
        const subprocess = spawn(process.argv0, process.argv.slice(1), {
            detached: true,
            stdio: 'ignore'
        });
        subprocess.unref();

        await message.channel.send('Restarting...');

        process.exit(0);
    }
}

module.exports = RestartCommand;