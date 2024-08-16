import got from 'got';
import * as t from 'io-ts';

import Plugin from '../../structs/Plugin';
import Twinkle from '$src/Twinkle';
import { ConfigProvider } from '$src/structs/Config';
import { assert } from 'assertmin';

const YouTubeConfigSchema = t.type({
    TOKENS: t.array(t.string)
});

export const YoutubeSearchApiSchema = t.type({
    items: t.array(t.type({
        snippet: t.type({
            title: t.string
        }),
        id: t.type({
            videoId: t.string
        })
    }))
});

export default class YouTubePlugin extends Plugin {
    private config: t.TypeOf<typeof YouTubeConfigSchema>;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.config = bot.config.getOptionTyped('YOUTUBE', YouTubeConfigSchema);
    }

    getToken() {
        const index = Math.floor(Math.random() * this.config.TOKENS.length);

        return this.config.TOKENS[index];
    }

    async search(query: string) {
        const results = await got('https://www.googleapis.com/youtube/v3/search', {
            searchParams: {
                part: 'snippet',
                q: query,
                key: this.getToken(),
                type: 'video'
            }
        }).json();

        assert(YoutubeSearchApiSchema.is(results));

        return results.items;
    }
}
