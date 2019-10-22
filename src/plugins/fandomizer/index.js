const got = require('got');
const Plugin = require('../../structs/Plugin.js');

class FandomizerPlugin extends Plugin {
    load() {
        this.bot.fandomizer = new Fandomizer(this.bot);
    }
}

class Fandomizer {
    constructor() {
        this.cache = new Map();
    }

    url(maybeWiki, alt) {
        const wikiname = this.sanitize(maybeWiki);

        if (!wikiname) return alt || null;

        if (!this.cache.has(wikiname)) {
            this.cache.set(wikiname, this.fetch(wikiname, alt));
        }

        return this.cache.get(wikiname);

    }

    sanitize(wikiname) {
        wikiname = wikiname.toLowerCase();

        const protocolIndex = wikiname.indexOf('://');
        if (protocolIndex != -1) {
            wikiname = wikiname.slice(protocolIndex + 3);
        }

        const pathIndex = wikiname.indexOf('/');
        if (pathIndex != -1) {
            wikiname = wikiname.slice(0, pathIndex);
        }

        wikiname = wikiname.replace(/\.(fandom\.com|wikia\.(com|org))$/, '');
        // wikiname = wikiname.replace(/^\.+|\.+$/, '');

        return wikiname;
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