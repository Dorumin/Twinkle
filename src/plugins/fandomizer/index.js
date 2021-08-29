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

    stripLocation(location) {
        const url = new URL(location);
        const parts = url.pathname.split('/');
        const host = url.hostname;

        parts.pop();
        parts.pop();

        const final = `https://${host}${parts.join('/')}`;

        return final;
    }

    async fetch(wikiname, alt) {
        const split = wikiname.split('.');
        const isMultipart = split.length > 1;

        const [wikia, fandom] = await Promise.allSettled([
            // Note: http necessary for wikia.com if multipart
            got.head(`${isMultipart ? 'http' : 'https'}://${wikiname}.wikia.com/`, { followRedirect: false }),
            // Final slash will or will not be present depending on the length of `split`
            // Hopefully, this doesn't matter
            got.head(`https://${split.pop()}.fandom.com/${split.join('/')}`, { followRedirect: false })
        ]);

        if (wikia.status === 'fulfilled') {
            return this.stripLocation(wikia.value.headers.location);
        }

        if (fandom.status === 'fulfilled') {
            return this.stripLocation(fandom.value.headers.location);
        }

        return alt || `http://${wikiname}.wikia.com`;
    }
}

module.exports = FandomizerPlugin;
