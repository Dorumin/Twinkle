import fs from 'fs';
import path from 'path';
import { Client, Intents, Guild, Message } from 'discord.js';
import { assert } from 'assertmin';
import * as t from 'io-ts';

import Config, { ConfigProvider, ConfigSource } from './structs/Config';
import Plugin from './structs/Plugin';
import { isPartial } from './util/partials';
import { hideProperties } from './util/define';

const TwinkleConfigSchema = t.partial({
    ENV: t.string,
    DEV: t.partial({
        GUILD: t.string
    }),
    INTENTS: t.array(t.number),
    OPERATORS: t.array(t.string),
    REPORTING: t.type({
        CHANNEL: t.string
    }),
    PLUGINS: t.partial({
        WHITELIST: t.array(t.string),
        BLACKLIST: t.array(t.string)
    })
});

class TwinkleInstance {
    public client: Client;
    public config: t.TypeOf<typeof TwinkleConfigSchema>;

    constructor(bot: Twinkle) {
        this.config = this.getConfig(bot);
        this.client = this.makeClient();
    }

    getConfig(bot: Twinkle) {
        const provider = bot.config;
        const config = {
            ENV: provider.getOption('ENV'),
            DEV: provider.getOption('DEV'),
            INTENTS: provider.getOption('INTENTS'),
            OPERATORS: provider.getOption('OPERATORS'),
            REPORTING: provider.getOption('REPORTING'),
            PLUGINS: provider.getOption('PLUGINS')
        };
        assert(TwinkleConfigSchema.is(config));

        return config;
    }

    makeClient() {
        return new Client({
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
                Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
                // DM activity
                Intents.FLAGS.DIRECT_MESSAGE_TYPING,
                // Live presence data
                Intents.FLAGS.GUILD_PRESENCES,
            ].concat(this.config.INTENTS ?? []),
            partials: [
                // "USER" | "CHANNEL" | "GUILD_MEMBER" | "MESSAGE" | "REACTION" | "GUILD_SCHEDULED_EVENT"
                'CHANNEL',
                'REACTION',
                'MESSAGE'
            ]
        });
    }
}

export default class Twinkle {
    private globalConfig: Config;
    public config: ConfigProvider;
    private instance: TwinkleInstance | null;
    private pluginInstances: Map<typeof Plugin, Plugin>;

    constructor()  {
        this.globalConfig = new Config();

        this.globalConfig.on('provider-read', (event) => {
            console.log(`Provider ${event.provider.label} read ${event.key}`);
        });

        this.globalConfig.on('unknown-provider', (event) => {
            console.error('Unknown provider try read', event);
        });

        this.config = this.makeConfigProvider('twinkle-base');
        this.instance = null;

        this.pluginInstances = new Map();
        hideProperties<any>(this, ['globalConfig', 'pluginInstances', 'instance']);
    }

    get client(): Client {
        return this.getInstance().client;
    }

    get loggedIn(): boolean {
        return this.instance !== null;
    }

    get dev() {
        return this.getInstance().config.ENV === 'development';
    }

    get operators() {
        return this.getInstance().config.OPERATORS ?? [];
    }

    getInstance() {
        if (!this.instance) {
            throw new Error('Cannot access client before Twinkle instance is ready and plugins started loading');
        } else {
            return this.instance;
        }
    }

    loadConfigSource(source: ConfigSource) {
        this.globalConfig.loadSource(source);
    }

    makeConfigProvider(label: string) {
        return this.globalConfig.makeProvider(label);
    }

    // Get a plugin but without instancing it if missing
    // Useful for checking if a plugin was registered
    getPlugin<T extends Plugin>(PluginConstructor: typeof Plugin): T | undefined {
        const maybePlugin = this.pluginInstances.get(PluginConstructor);

        // maybePlugin can be any plugin, technically, since the pluginInstances
        // maps to the base class
        // But obviously, it's going to be an instance of the plugin we called getPlugin with
        // Otherwise the implementation is buggy or someone messed with the mappings
        return maybePlugin as T | undefined;
    }

    listen(event: string, handler: (...args: any) => void, context: any) {
        if (!context) throw new Error(`Must pass a context to the ${event} listener`);

        const callback = this.wrapListener(handler, context);

        this.client.on(event, (...args) => {
            const anyPartial = args.some(isPartial);
            if (anyPartial) {
                console.error('Found partials');
                console.error(args);
                return;
            }

            callback.apply(null, args);
        });
    }

    listenPartial(event: string, handler: (...args: any) => void, context: any) {
        if (!context) throw new Error(`Must pass a context to the ${event} listener`);

        this.client.on(event, this.wrapListener(handler, context));
    }

    onlyDev(instance: any) {
        if (!this.dev) {
            return false;
        }

        const dev = this.getInstance().config.DEV;

        if (instance instanceof Guild) {
            return dev?.GUILD !== instance.id;
        }

        if (instance instanceof Message) {
            if (instance.guild) {
                return dev?.GUILD !== instance.guild.id;
            } else {
                return !this.operators.includes(instance.author?.id);
            }
        }

        return false;
    }

    loadPlugin<V extends Plugin, T extends typeof Plugin = typeof Plugin>(NewPlugin: T): V {
        const existing = this.pluginInstances.get(NewPlugin);
        if (existing !== undefined) {
            return existing as unknown as V;
        }
        if (this.loggedIn) throw new Error('Plugins must be loaded before calling login()');

        const config = this.makeConfigProvider(`plugin-${NewPlugin.name}`);
        // @ts-expect-error Don't pass it the abstract class
        const plugin = new NewPlugin(this, config);
        this.pluginInstances.set(NewPlugin, plugin);
        if (this.instance) {
            plugin.load();
        }

        return plugin;
    }

    loadPluginDir(dir: string) {
        const plugins = this.getInstance().config.PLUGINS;
        const whitelist = plugins?.WHITELIST;
        const blacklist = plugins?.BLACKLIST;

        fs.readdirSync(dir).forEach(file => {
            const p = path.join(dir, file);

            if (Array.isArray(whitelist) && !whitelist.includes(file)) {
                return;
            }

            if (Array.isArray(blacklist) && blacklist.includes(file)) {
                return;
            }

            const Plugin = require(p);
            this.loadPlugin(Plugin);
        });
    }

    onReady() {
        console.info('ready');
    }

    onError(error: Error) {
        return this.reportError('Unknown error:', error);
    }

    async makeInstance() {
        if (this.instance) {
            throw new Error('Do not instance twice');
        }

        this.instance = new TwinkleInstance(this);

        this.listen('ready', this.onReady, this);
        this.listen('error', this.onError, this);

        const promises = Array.from(this.pluginInstances.values()).map(plugin => plugin.load());

        await Promise.all(promises);
    }

    async login(token: string) {
        if (this.loggedIn) throw new Error('Do not call login() twice');

        await this.makeInstance();

        await this.client.login(token);
    }

    async reportError(message: string, error: unknown) {
        console.error(message, error);

        const reporting = this.getInstance().config.REPORTING;

        if (reporting) {
            let newMessage = message;
            if (error instanceof Error) {
                if (typeof error.stack === 'string') {
                    newMessage += `\`\`\`apache\n${error.stack.slice(0, 1000)}\`\`\``;
                } else {
                    newMessage += `\`\`\`json\n${JSON.stringify(error)}\`\`\``
                }
            } else {
                newMessage += `\`\`\`json\nStrange value thrown\n${error}\`\`\``
            }

            const channel = this.client.channels.cache.get(reporting.CHANNEL);
            if (channel && channel.isText()) {
                try {
                    await channel.send(newMessage);
                } catch(e) {
                    // Discard error, instance might be destroyed
                }
            }
        }
    }

    unhandledRejection(reason: Error) {
        return this.reportError('Unhanded rejection:', reason);
    }

    wrapListener(listener: (...args: any) => void, context: any) {
        return (...args: any) => {
            try {
                return listener.apply(context, args);
            } catch (error) {
                return this.reportError('Listener error:', error as Error);
            }
        };
    }

    async cleanup() {
        for (const plugin of this.pluginInstances.values()) {
            await plugin.cleanup();
        }

        this.client.destroy();
    }
}
