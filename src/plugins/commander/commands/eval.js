const OPCommand = require('../structs/opcommand.js');

class EvalCommand extends OPCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['eval'];
        this.hidden = true;
    }

    async call(message, content) {
        let code = content;
        if (code.startsWith('```') && code.endsWith('```')) {
            code = code.slice(3, -3);
            if (['js', 'javascript'].includes(code.split('\n', 1)[0])) {
                code = code.replace(/^.+/, '');
            }
        }

        console.log(content);

        let send = message.channel.send.bind(message.channel);
        let bot = this.bot;
        let client = bot.client;

        this.constructor.use(send, bot, client);

        try {
            eval(code);
        } catch(e) {
            send('```http\n' + e + '```');
        }
    }

    static use() {}
}

module.exports = EvalCommand;