const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

const PORTABILITY_ID = '311612168061714432';

class PortabilityCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['portability', 'rmportability'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the Portability role.`;
        this.desc = `
            Gives you the Portability role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!portability'
        ];
    }

    async call(message, content, { interaction }) {
        if (content) return;

        const had = message.member.roles.cache.has(PORTABILITY_ID);
        if (had) {
            await message.member.roles.remove(PORTABILITY_ID);
        } else {
            await message.member.roles.add(PORTABILITY_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${PORTABILITY_ID}> role has been taken away`
                    : `You have been given the <@&${PORTABILITY_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}

module.exports = PortabilityCommand;
