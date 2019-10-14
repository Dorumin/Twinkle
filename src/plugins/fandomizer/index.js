const got = require('got');
const Plugin = require('../../structs/plugin.js');

class FandomizerPlugin extends Plugin {
    load() {
        this.bot.fandomizer = new Fandomizer(this.bot);
    }
}

class Fandomizer {
    constructor(bot) {
        this.cache = new Map();
    }

    url(wikiname) {
        if (!this.cache.has(wikiname)) {
            this.cache.set(wikiname, this.fetch(wikiname));
        }

        return this.cache.get(wikiname);

    }

    async fetch(wikiname, alt) {
        // Note: http necessary
        const { headers, statusCode } = await got.head(`http://${wikiname}.wikia.com/api.php`, { followRedirect: false });

        // Status code used for https://community.fandom.com/wiki/Community_Central:Not_a_valid_community?from=X
        if (statusCode == 302) return alt || `http://${wikiname}.wikia.com`;

        const url = new URL(headers.location),
        parts = url.pathname.split('/'),
        host = url.hostname;

        parts.pop();

        const final = `https://${host}${parts.join('/')}`;

        return final;
    }
}

module.exports = FandomizerPlugin;