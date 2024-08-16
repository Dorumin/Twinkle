import { SlashCommandBuilder, ActionRowBuilder } from '@discordjs/builders';
import { Message } from 'discord.js';
import * as t from 'io-ts';

import Command from '../structs/Command';
import YouTubePlugin, { YoutubeSearchApiSchema } from '../../youtube';
import CommandUtilsPlugin, { ReactionManager } from '../../command-utils';
import FormatterPlugin from '../../fmt/index';
import Twinkle from '$src/Twinkle';
import { CommandCallExtraPayload } from '..';

export default class YouTubeCommand extends Command {
    private fmt: FormatterPlugin;
    private youtube: YouTubePlugin;
    private cmdutils: CommandUtilsPlugin;

    constructor(bot: Twinkle) {
        super(bot);

        this.aliases = ['youtube', 'yt', 'yts'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('The search query')
                    .setRequired(true)
            );

        this.shortdesc = `Searches youtube`;
        this.desc = `
            Searches YouTube for a given search query
            The prefix "yts" provides a set of results
            `;
        this.usages = [
            '!yt Ken Ashcorp',
            '!yts Tom Scott'
        ];

        this.fmt = bot.loadPlugin(FormatterPlugin);
        this.youtube = bot.loadPlugin(YouTubePlugin);
        this.cmdutils = bot.loadPlugin(CommandUtilsPlugin);
    }

    async call(message: Message, content: string, { alias }: CommandCallExtraPayload) {
        if (!content) {
            await message.channel.send('Please provide a search query.');
            return;
        }

        const results = await this.youtube.search(content);

        if (results.length === 0) {
            await message.channel.send('Sorry, no results!');
            return;
        }

        if (alias === 'yts') {
            await this.postResults(message, results);
        } else {
            await message.channel.send(`https://youtu.be/${results[0].id.videoId}`);
        }
    }

    async postResults(originalMessage: Message, results: t.TypeOf<typeof YoutubeSearchApiSchema>['items']) {
        if (results.length > 5) {
            results = results.slice(0, 5);
        }

        const content = this.fmt.codeBlock('asc',
            results.map((result, i) => `[${i + 1}] ${result.snippet.title}`)
                .join('\n')
        );
        const message = await originalMessage.channel.send(content);

        const manager = this.cmdutils.reactionManager(message)
            .timeout(30000)
            .onTimedOut(() => {
                message.edit('Sorry, you took too long!');
            })
            .addUserId(originalMessage.author.id);

        for (let index = 0; index < results.length; index++) {
            manager.addReaction(
                this.getEmoji(index + 1),
                this.onResultChoose.bind(this, {
                    message,
                    results,
                    index,
                    manager
                })
            );
        }

        await manager.listen();
    }

    getEmoji(index: number) {
        switch (index) {
            case 1: return '1️⃣';
            case 2: return '2️⃣';
            case 3: return '3️⃣';
            case 4: return '4️⃣';
            case 5: return '5️⃣';
            default: return '🤷‍♀️';
        }
    }

    async onResultChoose({
        message,
        results,
        index,
        manager
    }: {
        message: Message,
        results: t.TypeOf<typeof YoutubeSearchApiSchema>['items'],
        index: number,
        manager: ReactionManager
    }) {
        // Discard all reactions, likely to fail because message is attempted
        // to be deleted next
        manager.clear().catch(() => {});

        const result = results[index];

        try {
            await Promise.all([
                message.delete(),
                message.channel.send(`https://youtu.be/${result.id.videoId}`)
            ]);
        } catch(e) {}
    }
}
