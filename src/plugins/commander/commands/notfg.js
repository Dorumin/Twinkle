const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

class NotFandomCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['notfg', 'notfandom'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Dev is not F/G.`;
        this.desc = `Tells people to go to F/G.`;
    }

    async call(message) {
        await message.channel.send(`${message.guild?.name} is not Fandom/Gamepedia. To complain about Fandom features and changes, you can find open ears at <https://discord.gg/fandom>`);
    }
}

module.exports = NotFandomCommand;
