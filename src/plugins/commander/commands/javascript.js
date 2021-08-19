const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

const JS_ID = '269869828691591169';

class JavaScriptCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['javascript', 'js', 'rmjavascript', 'rmjs'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the JavaScript role.`;
        this.desc = `
            Gives you the JavaScript role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!javascript'
        ];
    }

    async call(message, content, { interaction }) {
        if (content) return;

        const had = message.member.roles.cache.has(JS_ID);
        if (had) {
            await message.member.roles.remove(JS_ID);
        } else {
            await message.member.roles.add(JS_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${JS_ID}> role has been taken away`
                    : `You have been given the <@&${JS_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}

module.exports = JavaScriptCommand;
