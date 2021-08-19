const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

const CSS_ID = '269869854440423429';

class CSSRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['css', 'rmcss'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the CSS role.`;
        this.desc = `
                    Gives you the CSS role if you don't have it, or removes it if you do.
                    Deletes your message afterwards.`;
        this.usages = [
            '!css'
        ];
    }

    async call(message, content, { interaction }) {
        if (content) return;

        const had = message.member.roles.cache.has(CSS_ID);
        if (had) {
            await message.member.roles.remove(CSS_ID);
        } else {
            await message.member.roles.add(CSS_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${CSS_ID}> role has been taken away`
                    : `You have been given the <@&${CSS_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}

module.exports = CSSRoleCommand;
