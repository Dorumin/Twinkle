const { SlashCommandBuilder } = require('@discordjs/builders');
const ModCommand = require('../structs/ModCommand.js');
const AutoModPlugin = require('../../automod');
const LockdownFilter = require('../../automod/filters/Lockdown');

class LockdownCommand extends ModCommand {
    static get deps() {
        return [
            AutoModPlugin
        ];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['lockdown', 'raid'];
        this.schema = new SlashCommandBuilder()
            .addIntegerOption(option =>
                option.setName('enabled')
                    .setDescription('Must be on or off. Missing to toggle')
            );

        this.hidden = true;
        this.shortdesc = `Enables lockdown mode.`;
        this.desc = `
                    Locks down the server so new members will be muted on join.
                    Also called "raid mode".
                    Pass "on" or "off" as the first argument to explicitly toggle.
                    You need to be a moderator to use this command.`;
        this.usages = [
            '!lockdown <on/off>'
        ];
        this.examples = [
            '!lockdown',
            '!raid on',
            '!raid off'
        ];

        this.lockdown = this.bot.automod.filters.find(filter => filter instanceof LockdownFilter);
    }

    async call(message, content) {
        if (!message.guild) {
            await message.channel.send('Use this in a guild');
            return;
        }

        let enable;
        switch (content.toLowerCase()) {
            case 'on':
                enable = true;
                break;
            case 'off':
                enable = false;
                break;
            default:
                enable = !this.lockdown.lockdownGuilds.has(message.guild.id);
                break;
        }

        if (enable === this.lockdown.lockdownGuilds.has(message.guild.id)) {
            if (enable) {
                await message.channel.send('The guild is already locked down');
            } else {
                await message.channel.send('The guild is not locked down');
            }

            return;
        }


        if (enable) {
            this.lockdown.lockdownGuilds.add(message.guild.id);
            await message.channel.send('The guild has been locked down');
        } else {
            this.lockdown.lockdownGuilds.delete(message.guild.id);
            await message.channel.send('The guild has been freed');
        }
    }
}

module.exports = LockdownCommand;
