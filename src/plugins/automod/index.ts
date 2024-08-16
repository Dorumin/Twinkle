import * as t from 'io-ts';

import { ConfigProvider } from '../../structs/Config';
import Twinkle from '../../Twinkle';
import Plugin from '../../structs/Plugin';
import AutomodFilter from './structs/AutomodFilter';
import { Message, TextChannel } from 'discord.js';

const AutomodConfigSchema = t.type({
    FILTERS: t.array(t.string),
    GUILDS: t.array(t.string),
    LOGGING: t.string
});

export default class AutomodPlugin extends Plugin {
    private config: t.TypeOf<typeof AutomodConfigSchema>;
    private filterInstances: Map<string, AutomodFilter>;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.config = config.getOptionTyped('AUTOMOD', AutomodConfigSchema);

        this.filterInstances = new Map();
    }

    get filters() {
        return Array.from(this.filterInstances.values());
    }

    async load() {
        for (const filterModule of this.config.FILTERS) {
            let Filter = require(`./filters/${filterModule}`);

            if ('default' in Filter && Filter.default.prototype instanceof AutomodFilter) {
                Filter = Filter.default;
            }

            const config = this.bot.makeConfigProvider(`automod-filter-${filterModule}`);
            const filter = new Filter(this, config);

            this.filterInstances.set(filterModule, filter);
        }

        this.bot.listen('messageCreate', this.onMessage, this);
    }

    getBot() {
        return this.bot;
    }

    async logchan() {
        const channel = await this.bot.client.channels.fetch(this.config.LOGGING);

        if (channel instanceof TextChannel) {
            return channel;
        } else {
            return null;
        }
    }

    async onMessage(message: Message) {
        // Ignore bots and self, and if there isn't a member property
        if (
            !message.guild ||
            !this.config.GUILDS.includes(message.guild.id) ||
            message.author.bot ||
            message.author.id == this.bot.client.user?.id
        ) return;

        // Fetch members not already in member cache
        if (!message.member) {
            try {
                await message.guild.members.fetch(message.author.id);

                // message.member = member;
            } catch(e) {
                // User no longer has a member :pensive:
                return;
            }
        }

        this.filters.forEach(async (filter) => {
            const interest = filter.interested(message);
            let result;

            if (interest instanceof Promise) {
                try {
                    result = await interest;
                } catch (error) {
                    result = false;
                    await this.bot.reportError('Failed to fetch interest:', error);
                }
            } else {
                result = interest;
            }

            if (result) {
                try {
                    filter.handle(message);
                } catch (error) {
                    await this.bot.reportError('Failed to handle message:', error);
                }
            }
        });
    }
}
