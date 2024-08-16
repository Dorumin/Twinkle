import { CacheType, Collection, CommandInteraction, CommandInteractionOption, WebhookMessageOptions } from 'discord.js';

import { MessageMentions } from 'discord.js';

// Copy the useful ones from https://discord.js.org/#/docs/main/stable/class/CommandInteraction if you need
const INTERACTION_REFLECT_KEYS = [
    // "applicationId",
    "channelId",
    // replaced with a proxy in the compat layer
    // "channel",
    // "client",
    "createdAt",
    "createdTimestamp",
    // "guild",
    "guildId",
    "id",
    // "member",
    // Not compatible
    // "type"
] as const;

type CompatPayload = string | Omit<WebhookMessageOptions, "username" | "avatarURL" | "flags">;

export default class InteractionCompatibilityLayer {
    static stringifyOption(option: CommandInteractionOption<CacheType>) {
        if (option.value == null && option.type !== 'SUB_COMMAND') {
            return '';
        }

        switch (option.type) {
            case 'SUB_COMMAND':
                return (option.name + ' ' + InteractionCompatibilityLayer.stringifyOptions(option.options)).trim();
            case 'USER':
                return `<@${option.value}>`;
            case 'CHANNEL':
                return `<#${option.value}>`;
            case 'ROLE':
                return `<@&${option.value}>`;
            case 'MENTIONABLE':
                if (option.user || option.member) {
                    return `<@${option.value}>`;
                } else if (option.channel) {
                    return `<#${option.value}>`;
                } else if (option.role) {
                    return `<@&${option.value}>`;
                }
            default:
                return option.value?.toString();
        }
    }

    static stringifyOptions(options?: readonly CommandInteractionOption<CacheType>[]) {
        let content = '';

        if (!options) return content;

        for (const option of options) {
            content += InteractionCompatibilityLayer.stringifyOption(option) + ' ';
        }

        return content.slice(0, -1);
    }

    private inner!: CommandInteraction;
    public _replied: boolean;
    private _succeeded: boolean;
    public _unprefixedContent: string;
    public content: string;
    private channelId: string | null;
    private createdAt: Date;
    private createdTimestamp: number;
    private guildId: string | null;
    private id: string;

    constructor(interaction: CommandInteraction) {
        Object.defineProperty(this, 'inner', { value: interaction });
        Object.defineProperty(this, 'client', { value: interaction.client });

        this._replied = false;
        this._succeeded = false;

        const content = InteractionCompatibilityLayer.stringifyOptions(interaction.options.data);

        this._unprefixedContent = content;
        this.content = '/' + this.inner.commandName + ' ' + content;

        this.channelId = this.inner.channelId;
        this.createdAt = this.inner.createdAt;
        this.createdTimestamp = this.inner.createdTimestamp;
        this.guildId = this.inner.guildId;
        this.id = this.inner.id;
    }

    async reply(response: CompatPayload) {
        if (this._replied) {
            return await this.inner.channel?.send(response);
        }

        this._replied = true;

        let returned;
        try {
            returned = await this.inner.reply(response);
        } catch(e) {
            if (!this._succeeded) {
                this._replied = false;
            }

            throw e;
        }

        this._succeeded = true;

        if (returned === undefined) {
            return await this.inner.fetchReply();
        }

        return returned;
    }

    get channel() {
        if (this.inner.channel === null) {
            return null;
        }

        return new Proxy(this.inner.channel, {
            get: (target, key) => {
                if (key === 'send') {
                    return (payload: CompatPayload) => {
                        return this.reply(payload);
                    };
                }

                return Reflect.get(target, key);
            }
        });
    }

    get guild() {
        return this.inner.guild;
    }

    get member() {
        return this.inner.member;
    }

    get author() {
        return this.inner.user;
    }

    get mentions() {
        const users = new Collection();

        for (const match of this._unprefixedContent.matchAll(MessageMentions.USERS_PATTERN)) {
            const id = match[1];
            const user = this.inner.client.users.cache.get(id);

            if (user) {
                users.set(id, user);
            }
        }

        // @ts-expect-error We're breaking in
        const mentions = new MessageMentions(this, null, null, false, false);

        // Passing `users` to the mentions constructor seems to do weird stuff
        // You end up with invalid structures with all null fields
        mentions.users = users;

        return mentions;
    }

    get attachments() {
        return new Collection();
    }

    get reactions() {
        return new Collection();
    }
}
