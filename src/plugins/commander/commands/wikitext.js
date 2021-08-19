const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

const WIKITEXT_ID = '269869867123867650';

class WikitextRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['wikitext', 'rmwikitext'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the Wikitext role.`;
        this.desc = `
            Gives you the Wikitext role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!wikitext'
        ];
    }

    async call(message, content, { interaction }) {
        if (content) return;

        const had = message.member.roles.cache.has(WIKITEXT_ID);
        if (had) {
            await message.member.roles.remove(WIKITEXT_ID);
        } else {
            await message.member.roles.add(WIKITEXT_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${WIKITEXT_ID}> role has been taken away`
                    : `You have been given the <@&${WIKITEXT_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}

module.exports = WikitextRoleCommand;
