const { SlashCommandBuilder } = require('@discordjs/builders');
const Command = require('../structs/Command.js');

const LUA_ID = '269869890087682049';

class LuaRoleCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['lua', 'rmlua'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = `Gives you the Lua role.`;
        this.desc = `
            Gives you the Lua role if you don't have it, or removes it if you do.
            Deletes your message afterwards.`;
        this.usages = [
            '!lua'
        ];
    }

    async call(message, content, { interaction }) {
        if (content) return;

        const had = message.member.roles.cache.has(LUA_ID);
        if (had) {
            await message.member.roles.remove(LUA_ID);
        } else {
            await message.member.roles.add(LUA_ID);
        }

        if (interaction) {
            await interaction.reply({
                content: had
                    ? `The <@&${LUA_ID}> role has been taken away`
                    : `You have been given the <@&${LUA_ID}> role`,
                ephemeral: true
            });
        } else {
            await message.delete();
        }
    }
}

module.exports = LuaRoleCommand;
