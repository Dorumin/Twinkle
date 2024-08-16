import { ConfigProvider } from '$src/structs/Config';
import Twinkle from '$src/Twinkle';
import { Message, MessageReaction } from 'discord.js';
import Plugin from '../../structs/Plugin';

export default class CommandUtilsPlugin extends Plugin {
    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);
    }

    reactionManager(message: Message) {
        return new ReactionManager({
            bot: this.bot,
            message
        });
    }
}

export class ReactionManager {
    private bot: Twinkle;
    private message: Message;

    private finished: boolean;
    private timeoutActivity: number | undefined;
    private timeoutId: number | NodeJS.Timeout;
    private globalTimeoutId: number | NodeJS.Timeout;

    private _onTimedOut: ((manager: this) => void) | undefined;
    private _onFinish: (() => void) | undefined;

    private userIds: string[];
    private reactions: Record<string, (reaction: MessageReaction) => void>;

    constructor({ bot, message }: { bot: Twinkle, message: Message }) {
        this.bot = bot;
        this.message = message;

        this.finished = false;
        this.timeoutActivity = undefined;
        this.timeoutId = -1;
        this.globalTimeoutId = -1;

        this.userIds = [];
        this.reactions = {};
    }

    addUserId(userId: string) {
        this.userIds.push(userId);

        return this;
    }

    addReaction(emoji: string, handler: (reaction: MessageReaction) => void) {
        this.reactions[emoji] = handler;

        return this;
    }

    timeout(ms: number) {
        this.timeoutActivity = ms;

        return this;
    }

    globalTimeout(ms: number) {
        this.globalTimeoutId = setTimeout(this.onTimeout.bind(this), ms);

        return this;
    }

    onTimeout() {
        this.finished = true;
    }

    async listen() {
        let firstEmoji = true;
        for (const emoji in this.reactions) {

            const promise = this.message.react(emoji);

            // if it's the first emoji
            if (firstEmoji) {
                // properly await it to propagate errors
                firstEmoji = false;
                await promise;
            } else {
                // otherwise, dispose errors, and start listening to
                // user reactions immediately
                promise.catch(() => {});
            }
        }

        while (true) {
            if (this.finished) break;

            const reactions = await this.message.awaitReactions({
                filter: (reaction, user) => {
                    if (user.id === this.bot.client.user?.id) {
                        return false;
                    }

                    if (this.userIds.length !== 0 && !this.userIds.includes(user.id)) {
                        return false;
                    }

                    if (!Object.keys(this.reactions).includes(reaction.emoji?.name ?? '')) {
                        return false;
                    }

                    return true;
                },
                time: this.timeoutActivity,
                max: 1
            });

            if (this.finished) break;

            if (!reactions.size) {
                if (this._onTimedOut) {
                    this._onTimedOut(this);
                }

                break;
            }

            const reaction = reactions.first()!;
            const handler = this.reactions[reaction.emoji.toString()];

            handler(reaction);
        }

        if (this._onFinish) {
            this._onFinish();
        }
    }

    clear() {
        this.finish();

        const promises = [];

        for (const emoji in this.reactions) {
            const reaction = this.message.reactions.cache.get(emoji);

            if (reaction) {
                promises.push(reaction.remove());
            }
        }

        return Promise.all(promises);
    }

    finish() {
        this.finished = true;

        if (this.globalTimeoutId) {
            clearTimeout(this.globalTimeoutId);
        }

        return this;
    }

    onFinish(handler: () => void) {
        this._onFinish = handler;

        return this;
    }

    onTimedOut(handler: (manager: this) => void) {
        this._onTimedOut = handler;

        return this;
    }
}
