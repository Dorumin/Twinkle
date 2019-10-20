const Plugin = require('../../structs/plugin.js');
const Cache = require('../../structs/cache.js');

class LoggerPlugin extends Plugin {
    load() {
        this.bot.logger = new Logger(this.bot);
    }
}

class Logger {
    constructor(bot) {
        this.writers = new Cache();
        bot.client.on('message', this.onMessage.bind(this));
    }

    onMessage(message) {

    }

    log(label, message) {
        if (!message) {
            message = label;
            label = 'channel';
        }

        console.log(`[${label}] ${message}`);
    }
}

module.exports = LoggerPlugin;