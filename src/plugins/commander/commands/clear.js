const got = require('got');
const ModCommand = require('../structs/command.js');

class ClearCommand extends ModCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['clear', 'clean'];
        this.CHECKMARK = '✅';
        this.CROSS = '❌';
        this.DISCORD_EPOCH = 1420070400000;

        this.shortdesc = 'Bulk deletes messages.';
        this.desc = 'Deletes messages in bulk from the current channel.\nYou can mention a user to only delete their messages. If you do, messages older than 2 weeks will not be able to be deleted.\nYou need have the manage messages permission to use this command.';
        this.usages = [
            '!clear <count> [@users]'
        ];
        this.examples = [
            '!clear 50',
            '!clear 50 @Doru',
            '!clear @Kocka 50 @Doru'
        ];
    }

    async call(message, content) {
        const userIds = message.mentions.users.array().map(user => user.id);
        const cleanContent = content.replace(/<@!?\d+>/g, '');
        const limit = parseInt(cleanContent.trim());

        if (!limit) {
            await message.channel.send('You need to add a number of messages to delete!');
            return;
        }

        const confirmation = await message.channel.send('Loading messages...');
        const messages = await this.loadMessages(message.channel, limit, userIds, confirmation.id);

        if (!messages.length) {
            await confirmation.edit('No messages found.');
            return;
        }

        const newer = [];
        const older = [];

        for (const id of messages) {
            if (this.olderThan2Weeks(id)) {
                older.push(id);
            } else {
                newer.push(id);
            }
        }

        const countMessage = older.length
            ? `Loaded ${messages.length} messages, ${newer.length} of which can be batched, and ${older.length} will be slow (15/min) deleted (because they're older than 2 weeks). Confirm deletion?`
            : `Loaded ${messages.length} messages! Confirm deletion?`

        await Promise.all([
            confirmation.edit(countMessage),
            this.react(confirmation, this.CHECKMARK, this.CROSS),
        ]);

        const reactions = await confirmation.awaitReactions(
            (reaction, user) => {
                return user.id == message.author.id && [this.CHECKMARK, this.CROSS].includes(reaction.emoji.name);
            },
            {
                time: 15000,
                max: 1
            }
            // why isn't this on a new line? single line {} is gross.
            // Better?
            // Much <3
            // Lmao having it on a separate line feels kinda weird but sure
            // I'm not really used to seeing single line .css({}) tbh, it's fucking disgusting
            // Lmao this reminds me of when I first tried this out with Sophie and I did this exact same comment shit because we didn't have live share chat back then
            // How fast did he type? ;^)
            // Took 20 seconds to type "ok"
            // LOL
            // TRAGIC
            // Also lol now you can see everything I delete smh
            // And every typo by extension LMAO
            // No privacy af
            // Just how I like it ;D
            // Then again I also make quite a few typos myself
            // Lmao this is how chats should be tbhh, I wonder if someone'll come up with something like this
            // That isn't like, on a fucking code editor
            // lmao I could try to design something like that on the chat that you wanted me to design for Discord, thing is that I'd hit the ratelimits lmaoo
            // That was actually my initial idea, to have a separate chat, not one that interfaced with Discord :P
            // For the iPad?
            // Yeah, and use SockJS for it, which works on ipads apparently
            // And reaaaaact
            // Man that's wonderful news lol, try it then, I just wanted somewhere to talk on the iPad better really :P
            // A place we both agreed on because Twitter and Messenger are complete twats that force me to reload every time to check a new message and Discord won't even load LMAO, just a complete white screen
            // And well you hate PS so
            // Also if you do decide to do that make \\^^ a thing ;D
            // Lmao you sure love those markdown thingies don't you
            // I'll probably yoink some message parser off of npm if I have to, or make my own
            // I'm pretty sure making some abstract syntax trees would be a really fun exercise anyway
            // I did them for relay, yk how *this* is translated to __this__ when sent to PS?
            // I parse every fucking token myself
            // lmao what th efuck why did that happen ROFL
            // Also lol watching you make typos is making me laugh incredibly hard idefk why I can't even type right
            // Lmao is that because I usually always fix them before sending? :P
            // Ctrl backspace does wonders in faking my actual accuracy
            // lmao I gotta check out what that does later, but rn I need to do some dishes again :P
            // Soup So brb :brb:
            // Huh haven't seen you use that emote in a while, why soup?
            // And yeah sure lmao, can't you see it in how I delete stuff, the whole word dies?
            // Yeah I know that's a thing I just can't remember the command for it on the mac
            // Also nah I already finished the soup I'm just washing the dishes :P
            // Yeah lmao but why are soup dishes more time consuming?
            // Because it uses a fucking pot :P
            // Oh lol, so you're not really cleaning plates but the whole sink lol okay
            // lmao yeah
            // i also need to sleep btw, we should totally do this when I let you see the code for Para Él ;D
            // Lmao yeah sure, if there's still things left to do :P
            // Or you wanna see how I nitpick in real time every little line of code you wrote
            // lmao that ^
            // Or improve it :P
            // I know youc an't bear to touch code I make but dw it's for the greater good ;DDDD
            // Nighty
            // No that's wrong you know I'm gonna put my hands all over anything you touch
            // Especially if it's you
        );

        if (reactions.size === 0) {
            await Promise.all([
                confirmation.edit('Your time ran out!'),
                this.clearReactions(confirmation)
            ]);
            return;
        }

        const emoji = reactions.first().emoji;

        switch (emoji.name) {
            case this.CHECKMARK:
                const chunks = this.chunk(newer, 100);
                await Promise.all([
                    confirmation.edit('Starting batch deletion, no turning back now!'),
                    this.clearReactions(confirmation)
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

                await Promise.all([
                    confirmation.delete(),
                    message.channel.send(resultText),
                ]);
                break;
            case this.CROSS:
                await Promise.all([
                    confirmation.edit('Cancelled bulk deletion, cheers!'),
                    this.clearReactions(confirmation)
                ]);
                break;
        }
    }

    async loadMessages(channel, limit, fromUsers, before) {
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