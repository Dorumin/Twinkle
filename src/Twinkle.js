const fs = require('fs');
const path = require('path');
const {Client, Intents} = require('discord.js');
const config = require('./util/config.js');

class Twinkle {
    constructor()  {
        this.client = new Client({
            allowedMentions: {
                parse: ['users', 'roles'],
                repliedUser: false
            },
            intents: [
                // We might want to listen for new threads
                Intents.FLAGS.GUILDS,
                // Join/leave events
                Intents.FLAGS.GUILD_MEMBERS,
                // In case we want to assign roles when users join or leave VC
                Intents.FLAGS.GUILD_VOICE_STATES,
                // Commands and moderation
                Intents.FLAGS.GUILD_MESSAGES,
                // Listening for reactions as commands
                Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                // Listening for commands in DM
                Intents.FLAGS.DIRECT_MESSAGES,
                // Reactions on commands like !help
                Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
            ].concat(config.TWINKLE.INTENTS || [])
        });
        this.config = config.TWINKLE;
        this.operators = this.config.OPERATORS;
        this._globalConfig = config;
        this._loggedIn = false;
        this._plugins = [];
        this.loadedPlugins = [];

        this.client.on('ready', this.wrapListener(this.onReady, this));
        this.client.on('error', this.wrapListener(this.onError, this));
    }

    loadPlugin(Plugin) {
        if (this._plugins.includes(Plugin)) return;
        if (this._loggedIn) throw new Error('Plugins must be loaded before calling login()');

        this._plugins.push(Plugin);

        if (Plugin.deps) {
            Plugin.deps.forEach(this.loadPlugin.bind(this));
        }

        const plugin = new Plugin(this);
        plugin.load();
        this.loadedPlugins.push(plugin);
    }

    loadPluginDir(dir) {
        const wl = this.config.PLUGINS.WHITELIST;
        const bl = this.config.PLUGINS.BLACKLIST;
        fs.readdirSync(dir).forEach(file => {
            const p = path.join(dir, file);
            if (wl instanceof Array && !wl.includes(file)) {
                return;
            }
            if (bl instanceof Array && bl.includes(file)) {
                return;
            }
            const Plugin = require(p);
            this.loadPlugin(Plugin);
        });
    }

    onReady() {
        console.info('ready');
    }

    onError(error) {
        return this.reportError('Unknown error:', error);
    }

    login(token) {
        if (this._loggedIn) throw new Error('Cannot call login() twice');

        this._loggedIn = true;
        this.client.login(token);
    }

    async reportError(message, error) {
        console.error(message, error);
        if (this.config.REPORTING) {
            let newMessage = message;
            if (error) {
                if (typeof error.stack === 'string') {
                    newMessage += `\`\`\`apache\n${error.stack.slice(0, 1000)}\`\`\``;
                } else {
                    newMessage += `\`\`\`json\n${JSON.stringify(error)}\`\`\``
                }
            }
            const channel = this.client.channels.cache.get(this.config.REPORTING.CHANNEL);
            if (channel) {
                await channel.send(newMessage);
            }
        }
    }

    unhandledRejection(reason) {
        return this.reportError('Unhanded rejection:', reason);
    }
    
    wrapListener(listener, context) {
        return function(arg) {
            try {
                return listener.call(context, arg);
            } catch (error) {
                return this.bot.reportError('Listener error:', error);
            }
        }.bind(this);
    }

    async cleanup() {
        for (const plugin of this.loadedPlugins) {
            await plugin.cleanup();
        }
        this.client.destroy();
    }
}

module.exports = Twinkle;
