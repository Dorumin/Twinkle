const got = require('got');
const Plugin = require('../../structs/plugin.js');

class FandomizerPlugin extends Plugin {
    load() {
        this.bot.fandomizer = new Fandomizer(this.bot);
    }
}

class Fandomizer {
    constructor(bot) {
        super(bot);
        this.cache = new Map();
    }

    fandomize(wikiname) {
        if (!this.cache.has(wikiname)) {
            this.cache.set(wikiname, this.fetch(wikiname));
        }

        return this.cache.get(wikiname);

    }

    async fetch(wikiname) {
        // Note: http necessary
        const { headers } = await got.head(`http://${wikiname}.wikia.com/api.php`, { followRedirects: false }),
        url = new URL(headers.location),
        parts = url.pathname.split('/'),
        host = url.hostname;

        parts.pop();

        const url = `https://${host}${parts.join('/')}`;

        return url;
    }
}

module.exports = FandomizerPlugin;