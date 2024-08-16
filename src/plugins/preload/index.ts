import { assert } from 'assertmin';
import Twinkle from '../../Twinkle';
import { ConfigProvider } from '../../structs/Config';
import Plugin from '../../structs/Plugin';

type PreloadConfig = {
    GUILDS: string[];
}

export default class PreloadPlugin extends Plugin {
    private intervalId: number | NodeJS.Timeout;
    private preloadConfig: PreloadConfig;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.intervalId = -1;

        this.preloadConfig = config.getOption('PRELOAD') as PreloadConfig;
        assert.shape(this.preloadConfig, {
            GUILDS: [String]
        });
    }

    async load() {
        this.bot.listen('ready', this.onReady, this);
    }

    async onReady() {
        this.intervalId = setInterval(async () => {
            for (const guildId of this.preloadConfig.GUILDS) {
                await this.preloadUsers(guildId);
            }
        }, 1000 * 60 * 60 * 6);
    }

    async preloadUsers(guildId: string) {
        const guild = await this.bot.client.guilds.fetch(guildId);
        if (!guild) return;

        try {
            await guild.members.fetch();
        } catch (error) {
            await this.bot.reportError(`Failed to preload guild ${guildId}. Have you enabled the guild members intent?`, error as Error);
        }
    }
}