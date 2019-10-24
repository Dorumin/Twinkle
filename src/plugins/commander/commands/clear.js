const got = require('got');
const CommandUtils = require('../structs/CommandUtils.js');
const ModCommand = require('../structs/ModCommand.js');

class ClearCommand extends ModCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['clear', 'clean', 'clr', 'purge'];
        this.CHECKMARK = '✅';
        this.CROSS = '❌';
        this.DISCORD_EPOCH = 1420070400000;

        this.shortdesc = 'Bulk deletes messages.';
        this.desc = 'Deletes messages in bulk from the current channel.\nYou can mention a user to only delete their messages. If you do, messages older than 2 weeks will not be able to be deleted.\nYou can also pass a message ID instead of a limit to delete messages starting from it, inclusive.\nYou need have the manage messages permission to use this command.';
        this.usages = [
            '!clear <count> [@users]',
            '!clear <messageId> [@users]',
        ];
        this.examples = [
            '!clear 50',
            '!clear 50 @Doru',
            '!clear 5368934126654455809 @Kocka',
            '!clear @Sophie 368934126654455809 @Doru'
        ];
    }

    async call(message, content) {
        const userIds = message.mentions.users.array().map(user => user.id);
        const cleanContent = content.replace(/<@!?\d+>/g, '').replace(/\D+/g, '');

        let arg;
        try {
            arg = BigInt(cleanContent);
        } catch(e) {
            arg = 0n;
        }

        if (!arg) {
            message.channel.send('You need to add a number of messages to delete!');
        }

        const type = arg > 1000000n && await this.messageExists(message.channel.id, arg)
            ? 'after'
            : 'limit';

        const [
            confirmation,
            messages
        ] = await Promise.all([
            message.channel.send('Loading messages...'),
            this.loadMessages(type, message.channel, arg, userIds, message.id)
        ]);

        if (!messages.length) {
            await confirmation.edit('No messages found.');
            return;
        }

        const newer = [];
        const older = [];

        if (type == 'after') {
            messages.push(arg.toString());
        } else {
            newer.push(message.id);
        }

        for (const id of messages) {
            if (this.olderThan2Weeks(id)) {
                older.push(id);
            } else {
                newer.push(id);
            }
        }

        console.log(type, messages, newer);

        const countMessage = older.length
            ? `Loaded ${messages.length} messages, ${newer.length} of which can be batched, and ${older.length} will be slow (15/min) deleted (because they're older than 2 weeks). Confirm deletion?`
            : `Loaded ${messages.length} messages! Confirm deletion?`

        await Promise.all([
            confirmation.edit(countMessage),
            CommandUtils.react(confirmation, this.CHECKMARK, this.CROSS),
        ]);

        const reactions = await confirmation.awaitReactions(
            (reaction, user) => {
                return user.id == message.author.id && [this.CHECKMARK, this.CROSS].includes(reaction.emoji.name);
            },
            {
                time: 15000,
                max: 1
            }
        );

        if (reactions.size === 0) {
            await Promise.all([
                confirmation.edit('Your time ran out!'),
                CommandUtils.clearReactions(confirmation)
            ]);
            return;
        }

        const emoji = reactions.first().emoji;

        switch (emoji.name) {
            case this.CHECKMARK:
                const chunks = this.chunk(newer, 100);
                await Promise.all([
                    confirmation.edit('Starting batch deletion, no turning back now!'),
                    CommandUtils.clearReactions(confirmation)
                ]);

                const [
                    failed1,
                    failed2
                ] = await Promise.all([
                    this.deleteChunks(message.channel, chunks),
                    this.deleteSequential(message.channel, older),
                ]);

                const failures = failed1 + failed2;
                const successes = messages.length - failures;
                let resultText = successes
                    ? `Deleted ${successes} messages succesfully!`
                    : `Couldn't delete messages! Check my permissions?`;

                if (failures) {
                    resultText += `\nFailed to delete ${failures} messages.`;
                }

                const [result] = await Promise.all([
                    message.channel.send(resultText),
                    confirmation.delete(),
                ]);

                if (!failures) {
                    await this.wait(5000);
                    await result.delete();
                }

                break;
            case this.CROSS:
                await Promise.all([
                    confirmation.edit('Cancelled bulk deletion, cheers!'),
                    CommandUtils.clearReactions(confirmation)
                ]);
                break;
        }
    }

    async messageExists(channelId, messageId) {
        const { body: messages } = await got(`https://discordapp.com/api/v6/channels/${channelId}/messages`, {
            json: true,
            query: {
                limit: 1,
                around: messageId
            },
            headers: {
                Authorization: 'Bot ' + this.bot.config.TOKEN
            }
        });

        if (!messages.length) return false;

        return messages[0].id == messageId;
    }

    loadMessages(type, channel, arg, fromUsers, messageId) {
        switch (type) {
            case 'limit':
                return this.loadMessagesCount(channel, arg, fromUsers, messageId);
            case 'after':
                return this.loadMessagesAfter(channel, arg, fromUsers, messageId);
            default:
                throw new Error('Unhandled message load type');
        }
    }

    async loadMessagesCount(channel, limit, fromUsers, before) {
        // Not using channel.fetchMessages: Idk why, messes with further reaction collecting
        const results = [];
        let lastId = before;
        let stopLoop = false;

        while (results.length < limit) {
            let { body: messages } = await got(`https://discordapp.com/api/v6/channels/${channel.id}/messages`, {
                json: true,
                query: {
                    limit: 100,
                    before: lastId
                },
                headers: {
                    Authorization: 'Bot ' + this.bot.config.TOKEN
                }
            });

            if (!messages.length) break;

            lastId = messages[messages.length - 1].id;

            if (fromUsers.length) {
                messages = messages.filter(message => {
                    return fromUsers.includes(message.author.id) && !this.olderThan2Weeks(message.id);
                });

                if (this.olderThan2Weeks(lastId)) {
                    stopLoop = true;
                }
            }

            if (messages.length) {
                const ids = messages
                    .map(message => message.id)
                    .slice(0, limit - results.length);

                results.push(...ids);
            }

            if (stopLoop) {
                break;
            }
        }

        return results;
    }

    async loadMessagesAfter(channel, after, fromUsers, before) {
        // Not using channel.fetchMessages either
        const results = [];
        let lastId = after;
        let stopLoop = false;

        while (true) {
            let { body: messages } = await got(`https://discordapp.com/api/v6/channels/${channel.id}/messages`, {
                json: true,
                query: {
                    limit: 100,
                    after: lastId,
                    before
                },
                headers: {
                    Authorization: 'Bot ' + this.bot.config.TOKEN
                }
            });

            if (!messages.length) break;

            lastId = messages[0].id;

            if (fromUsers.length) {
                messages = messages.filter(message => {
                    return fromUsers.includes(message.author.id) && !this.olderThan2Weeks(message.id);
                });

                if (this.olderThan2Weeks(lastId)) {
                    stopLoop = true;
                }
            }

            if (messages.length) {
                const ids = messages
                    .map(message => message.id);

                results.push(...ids);
            }

            if (stopLoop) {
                break;
            }
        }

        return results;
    }

    olderThan2Weeks(id) {
        const now = Date.now();
        const twoWeeksAgo = now - 1000 * 60 * 60 * 24 * 14;
        const big = BigInt(id);
        const time = Number(big >> 22n) + this.DISCORD_EPOCH;

        return time < twoWeeksAgo;
    }

    chunk(array, size) {
        const chunks = [];
        let i = 0;

        while (i < array.length) {
            chunks.push(array.slice(i, i + size));
            i += size;
        }

        return chunks;
    }

    async deleteChunks(channel, chunks) {
        let failures = 0;

        for (let i = 0; i < chunks.length; i++) {
            try {
                await channel.bulkDelete(chunks[i]);
            } catch(e) {
                console.log('Bulk deletion error', e);
                failures += chunks[i].length;
            }
        }

        return failures;
    }

    async deleteSequential(channel, messageIds) {
        let failures = 0;

        await this.parallelIter(messageIds.values(), 3, async id => {
            const deleted = await this.deleteWithRetries(15, channel.id, id);
            if (!deleted) failures++;
        });

        return failures;
    }

    async deleteWithRetries(retries, channelId, messageId) {
        while (true) {
            try {
                const res = await Promise.race([
                    this.wait(10000, 'timeout'), // TODO: Lower
                    got.delete(`https://discordapp.com/api/v6/channels/${channelId}/messages/${messageId}`, {
                        json: true,
                        headers: {
                            Authorization: `Bot ${this.bot.config.TOKEN}`
                        }
                    })
                ]);

                if (res == 'timeout') throw 'timeout';
                break;
            } catch(e) {
                if (e != 'timeout') {
                    console.log(e);
                }

                retries--;

                if (retries < 1) {
                    console.log(`Errored too much: ${messageId}`);
                    return false;
                }

                await this.wait(10000);
            }
        }

        return true;
    }

    async parallelIter(iterator, concurrent, fn) {
        let resolve;
        const promise = new Promise(res => resolve = res);
        let finished = 0;

        const cb = async ({ value, done }) => {
            if (done) {
                finished++;
                if (finished == concurrent) {
                    resolve();
                }
                return;
            }

            await fn(value);
            const next = iterator.next();
            if (next instanceof Promise) {
                next.then(cb);
            } else {
                cb(next);
            }
        };

        let i = concurrent;
        while (i--) {
            const next = iterator.next();
            if (next instanceof Promise) {
                next.then(cb);
            } else {
                cb(next);
            }
        }

        await promise;
    }
}

module.exports = ClearCommand;
