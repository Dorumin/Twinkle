const got = require('got');
const he = require('he');
const { CookieJar } = require('tough-cookie');
const Cache = require('../../structs/Cache.js');
const Plugin = require('../../structs/Plugin.js');
const FandomizerPlugin = require('../fandomizer');
const FormatterPlugin = require('../fmt');

class LinkerPlugin extends Plugin {
    static get deps() {
        return [
            FormatterPlugin,
            FandomizerPlugin
        ];
    }

    load() {
        this.bot.linker = new Linker(this.bot);
    }
}

class Linker {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.LINKER;
        this.cache = new Cache();
        this.replies = new Cache();
        this.namespaces = new Cache();
        this.jar = new CookieJar();
        this.loggingIn = this.login();

        this.ZWSP = String.fromCharCode(8203);
        this.LINK_REGEX = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
        this.TEMPLATE_REGEX = /\{\{([^{}|]+)(\|[^{}]*)?\}\}/g;
        this.SEARCH_REGEX = /(?<!\w)--(.+?)--(?!\w)/g;
        this.ENCODE_TABLE = {
            '20': '_'
        };

        this.linkTargets = [];
        this.searchTargets = [];
        this.templateTargets = [];

        // Note: All of these target functions are ordered from longest to shortest
        // They're also divided into sections according to their parameters and purpose
        // In case you think that matters, *it doesn't*
        // The [this.getTargetResult] function always gets the longest matching prefix
        // And since prefixes can't be repeated, it's deterministic
        this.addLinkTarget('github', ({ full }) => `https://github.com/${this.encode(full)}`);
        this.addLinkTarget('npm', ({ full }) => `https://npmjs.com/${this.encode(full)}`);
        this.addLinkTarget('mdn', ({ full }) => `https://developer.mozilla.org/search?q=${this.encode(full, { '20': '+' })}`);
        this.addLinkTarget('so', ({ full }) => `https://github.com/${this.encode(full, { '20': '+' })}`);
        this.addLinkTarget('mw', ({ full }) => `https://mediawiki.org/wiki/${this.encode(full)}`);

        this.addLinkTarget(['wp'], ['wikipedia'], ({ full }) => `https://en.wikipedia.org/wiki/${this.encode(full)}`);
        this.addLinkTarget(['g'], ['google'], ({ full }) => `https://github.com/${this.encode(full)}`);

        this.addLinkTarget('w', 'c', async ({ parts: [wiki, ...rest] }) => `${await this.wikiUrl(wiki)}/wiki/${this.encode(rest.join(':'))}`);
        this.addLinkTarget('w', ({ full }) => `https://community.fandom.com/wiki/${this.encode(full)}`);

        this.addLinkTarget(async ({ full, wiki }) => `${await this.wikiUrl(wiki)}/wiki/${this.encode(full)}`);

        // lol
        this.addLinkTarget('debug', (args) => {
            console.log(args);
            return `https://github.com/Dorumin/Twinkle`;
        });

        // Searching, if it can even be called that considering the quality of the results
        this.addSearchTarget('w', 'c', ({ parts: [wiki, ...rest] }) => this.fetchFirstSearchResult(rest.join(':'), wiki));
        this.addSearchTarget('w', ({ full }) => this.fetchFirstSearchResult(full, 'community'));
        this.addSearchTarget(({ full, wiki }) => this.fetchFirstSearchResult(full, wiki));

        // Special pages
        this.addTemplateTarget('special', 'prefixindex', ({ full, wiki }) => this.fetchPagesByPrefix(full, wiki));
        this.addTemplateTarget('special', () => `You can't preview special pages!`);

        // Silly utility stuff
        this.addTemplateTarget('lc', ({ full }) => full.toLowerCase());
        this.addTemplateTarget('uc', ({ full }) => full.toUpperCase());
        this.addTemplateTarget('fullurl', ({ full, params, wiki }) => this.getUrlFromParams(full, params, wiki));

        // Article previews
        this.addTemplateTarget('w', 'c', ({ parts: [wiki, ...rest], message }) => this.fetchArticleEmbed(rest, wiki, message));
        this.addTemplateTarget('w', ({ parts, message }) => this.fetchArticleEmbed(parts, 'community', message));
        this.addTemplateTarget(async ({ parts, wiki, message }) => this.fetchArticleEmbed(parts, wiki, message));

        // Debugging
        this.addTemplateTarget('debug', (args) => {
            console.log(args);
            return this.bot.fmt.codeBlock('json', JSON.stringify(args, (k, v) => {
                if (k === 'message') return { cyclic: true };
                if (k === 'params' && this.hasStringKeys(v)) return Object.assign({}, v);
                return v;
            }, 2));
        });

        bot.client.on('message', this.onMessage.bind(this));
    }

    hasStringKeys(arr) {
        for (const k in arr) {
            if (isNaN(k)) return true;
        }

        return false;
    }

    addLinkTarget(...args) {
        this.addTarget(this.linkTargets, args);
    }

    addSearchTarget(...args) {
        this.addTarget(this.searchTargets, args);
    }

    addTemplateTarget(...args) {
        this.addTarget(this.templateTargets, args);
    }

    addTarget(targets, args) {
        const callback = args.pop();
        const prefixes = [];

        if (args[0] instanceof Array) {
            prefixes.push(...args);
        } else {
            prefixes.push(args);
        }

        prefixes.forEach(prefix => {
            const length = prefix.reduce((sum, slice) => sum + slice.length, 0);

            let i = 0;
            for (; i < targets.length; i++) {
                const target = targets[i],
                pref = target[0],
                len = pref.reduce((sum, slice) => sum + slice.length, 0);

                if (len > length) {
                    break;
                }
            }

            targets.splice(i, 0, [ prefix, callback ]);
        });
    }

    async onMessage(message) {
        if (
            message.author.bot
        ) return;

        const wiki = await this.getWiki(message.guild);
        const promises = this.getPromises(message, wiki);
        const results = await Promise.all(promises);

        // console.log(results);

        for (const result of results) {
            if (!result) continue;

            const reply = await message.channel.send(result);

            Promise.all([
                reply.react('❌'),
                reply.awaitReactions(
                    (reaction, reactor) => reactor.id === message.author.id && reaction.emoji.name === '❌',
                    {
                        time: 60000,
                        max: 1
                    }
                ),
            ]).then(([reaction, reactions]) => {
                if (reactions.size) {
                    reply.delete();
                } else {
                    reaction.remove();
                }
            });
        }
    }

    login() {
        return got.post('https://services.fandom.com/auth/token', {
            form: {
                username: this.config.USERNAME,
                password: this.config.PASSWORD
            },
            cookieJar: this.jar
        });
    }

    async getWiki(guild) {
        const wikis = this.config.WIKIS;

        if (!guild) return wikis.default;

        return wikis[guild.id] || wikis.default;
    }

    getPromises(message, wiki) {
        const promises = [];
        const cleaned = this.cleanText(message.cleanContent);

        const links = this.match(this.LINK_REGEX, cleaned);
        const searches = this.match(this.SEARCH_REGEX, cleaned);
        const templates = this.match(this.TEMPLATE_REGEX, cleaned);

        if (links.length) {
            promises.push(...this.getLinks(links, wiki, message));
        }

        if (searches.length) {
            promises.push(...this.getSearches(searches, wiki, message));
        }

        if (templates.length) {
            promises.push(...this.getTemplates(templates, wiki, message));
        }

        return promises.slice(0, 5);
    }

    cleanText(str) {
        return str
            // Code blocks, ```a```, ``b``, `c`
            .replace(/(`{1,3})[\S\s]+?\1/gm, '')
            // Zero width spaces
            .replace(/\u200B/g, '');
    }

    removeNamespace(page) {
        if (typeof page === 'string') {
            page = page.split(':');
        }

        return page.slice(1).join(':');
    }

    wikiUrl(wiki) {
        return this.bot.fandomizer.url(wiki);
    }

    match(reg, str) {
        const matches = [];
        let m;
        reg.lastIndex = 0;

        while (m = reg.exec(str)) {
            matches.push(m);
        }

        return matches;
    }

    decodeHTML(str) {
        return he.decode(str, { isAttributeValue: true });
    }

    decodeHex(str, table = this.ENCODE_TABLE) {
        return str.replace(/%([0-9a-f]{2})/gi,
            (_, hex) => table[hex.toLowerCase()] || String.fromCharCode(parseInt(hex, 16)) || '%' + hex
        );
    }

    encode(str, table) {
        return encodeURIComponent(str)
            // Allow :, /, " ", and # in urls
            .replace(/%(3A|2F|20|23|2C)/gi, hex => this.decodeHex(hex, table))
            // Allow ?=s
            .replace(/(%3F|%26)([^%]+)%3D([^%]+)/gi, (_, char, key, value) => `${this.decodeHex(char)}${key}=${value}`)
            .trim();
    }

    escape(str) {
        return String(str).replace(/@|discord\.gg/g, `$&${this.ZWSP}`);
    }

    // Returns a parsed parameter list
    // Takes the form of an array that can also have key-value pairs
    // Requires the initial |, and excludes everything before it (like the template name, for example)
    // ignored|param1|param2 => [param1, param2]
    // ignored|arg1=val1|param1|arg2=val2|param2 => [param1, param2, arg1=val1, arg2=val2]
    parseParams(str) {
        const params = [];
        if (!str) return params;

        const split = str.split('|').slice(1);

        for (const i in split) {
            const param = split[i];
            const index = param.indexOf('=');

            if (index === -1) {
                const index = params.length;
                const value = param.trim();
                params[index] = value;
            } else {
                const key = param.slice(0, index).trim();
                const value = param.slice(index + 1).trim();
                params[key] = value;
            }
        }

        return params;
    }

    getTargetResult(targets, segments, wiki, params, message) {
        let i = targets.length;

        targetsLoop:
        while (i--) {
            const [ prefixes, callback ] = targets[i];

            let j = prefixes.length;
            while (j--) {
                if (!segments[j]) continue targetsLoop;
                if (segments[j].toLowerCase() !== prefixes[j]) continue targetsLoop;
            }

            const sliced = segments.slice(prefixes.length);

            return callback({
                full: sliced.join(':'),
                parts: sliced,
                wiki,
                params,
                message
            });
        }
    }

    getLinks(links, wiki) {
        // TODO: Implement 2000/2048 line splitting
        const embeds = [];

        const shouldEmbed = links.some(match => match[2]);
        const hyperLinks = Promise.all(
            links
                .map(match => this.getLink(match, wiki))
        );

        embeds.push(
            hyperLinks.then(links => {
                if (shouldEmbed) {
                    return {
                        embed: {
                            description: links.join('\n')
                        }
                    };
                } else {
                    return links.join('\n');
                }
            })
        );

        return embeds;
    }

    async getLink(match, wiki) {
        const linked = match[1],
        display = match[2],
        segments = linked.split(':').map(seg => seg.trim());

        const url = await this.getTargetResult(this.linkTargets, segments, wiki);

        if (display) {
            return this.bot.fmt.link(display, url);
        }

        return `<${this.bot.fmt.link(url)}>`;
    }

    getSearches(searches, wiki) {
        console.log(searches);
        const results = [];

        const searchResults = Promise.all(
            searches
                .map(match => this.getSearch(match, wiki))
        );

        results.push(
            searchResults.then(result => {
                return result.join('\n');
            })
        );

        return results;
    }

    async getSearch(match, wiki) {
        const searched = match[1],
        segments = searched.split(':').map(seg => seg.trim());

        const result = await this.getTargetResult(this.searchTargets, segments, wiki);

        if (typeof result === 'string') {
            return result;
        }

        return `<${result.url}>\n${result.snippet}`;
    }

    getTemplates(templates, wiki, message) {
        return templates.map(match => this.getTemplate(match, wiki, message));
    }

    async getTemplate(template, wiki, message) {
        const name = template[1],
        params = this.parseParams(template[2]),
        segments = name.split(/:|\//).map(seg => seg.trim());

        const result = await this.getTargetResult(this.templateTargets, segments, wiki, params, message);

        return result;
    }

    async fetchSearchResults(query, wiki) {
        const body = await got(`${await this.wikiUrl(wiki)}/api/v1/Search/List`, {
            searchParams: {
                query,
                // Adding a limit makes the endpoint sometimes throw a 404
                // limit,
                namespaces: '0'
            },
        }).json();

        if (!body.items || !body.items.length) return [];

        return body.items;
    }

    async fetchFirstSearchResult(query, wiki) {
        console.log('search', query, wiki);
        const pages = await this.fetchSearchResults(query, wiki);

        if (!pages || !pages[0]) return `No search results found for \`${query}\`.`;

        const page = pages[0],
        snippet = page.snippet
            .replace(/<span class="searchmatch">(.+?)<\/span>/g, '**$1**')
            .replace(/&hellip;/g, '...')
            .trim();

        return {
            url: page.url,
            snippet
        };
    }

    // API helper
    async api(wiki, params) {
        params.format = 'json';

        const body = await got(`${await this.wikiUrl(wiki)}/api.php`, {
            searchParams: params,
        }).json();

        return body;
    }

    async nsIsThread(ns) {
        return [1201, 2001].includes(ns);
    }

    // @TODO: Someday will have a proper check with local thread namespace aliases
    // But for now, it's pretty safe to just run two calls if the title without ns is a number
    async titleIsThread(segments, wiki) {
        return !isNaN(segments[1]);
    }

    async fetchArticleProps(segments, wiki) {
        const promises = [];

        promises.push(
            this.api(wiki, {
                action: 'query',
                prop: 'categories|revisions',
                clshow: '!hidden',
                rvprop: 'timestamp',
                titles: segments.join(':'),
                redirects: true
            })
        );

        if (await this.titleIsThread(segments, wiki)) {
            // Fetch content alongside everything else to extract thread title from ac_metadata tag
            promises.push(
                this.api(wiki, {
                    action: 'query',
                    prop: 'categories|revisions',
                    clshow: '!hidden',
                    rvprop: 'content|timestamp',
                    pageids: segments[1],
                    redirects: true
                })
            );
        }

        const [result, fallback] = await Promise.all(promises);

        if (result && result.query) {
            const page = Object.values(result.query.pages)[0];

            if (page && !page.hasOwnProperty('missing')) {
                return page;
            }
        }

        if (fallback && fallback.query) {
            const page = Object.values(fallback.query.pages)[0];

            if (page && !page.hasOwnProperty('missing')) {
                return page;
            }
        }

        return null;
    }

    async fetchThreadData(props, wiki) {
        if (!await this.nsIsThread(props.ns)) return null;

        const promises = [];
        const url = await this.wikiUrl(wiki);

        promises.push(
            this.api(wiki, {
                action: 'query',
                prop: 'revisions',
                list: 'allpages',
                rvdir: 'newer',
                rvprop: 'user|timestamp',
                pageids: props.pageid,
                redirects: true,
                apprefix: this.removeNamespace(props.title),
                apnamespace: props.ns,
                aplimit: 'max'
            })
        );

        promises.push(
            got(`${url}/wikia.php?controller=WallExternal&method=votersModal&format=html`, {
                searchParams: {
                    controller: 'WallExternal',
                    method: 'votersModal',
                    format: 'json',
                    id: props.pageid
                },
            }).json()
        );

        const data = {};
        const [ revisions, kudos ] = await Promise.all(promises);

        const titleMatch = props.revisions && props.revisions[0]['*'].match(/<ac_metadata\s*title="([^"]+)\s*[^>]*>\s*<\/ac_metadata>/);

        if (titleMatch) {
            data.threadTitle = this.decodeHTML(titleMatch[1]);
        }

        const first = Object.values(revisions.query.pages)[0];

        data.author = first.revisions[0].user;
        data.creation = first.revisions[0].timestamp;
        data.replyCount = revisions.query.allpages.length - 1;
        data.kudos = Number(kudos.count);
        data.isThread = true;
        data.isForum = props.ns == 2001;
        data.placement = props.title.split('/')[0].split(':')[1];

        const details = await got(`${url}/api/v1/User/Details`, {
            searchParams: {
                ids: data.author + (data.isForum ? '' : ',' + data.placement),
                size: 1000
            }
        }).json();

        data.authorAvatar = details.items[0] && details.items[0].avatar;
        data.wallAvatar = data.isForum
            ? undefined
            : details.items[1] && details.items[1].avatar;

        return data;
    }

    // Needs not use Promise.all, as each await is run consecutively
    // It's just cleaner this way, even if it may look like an inefficient way to do it
    // Promises aren't constructed in the loop, just accessed
    async awaitPromiseObject(promises) {
        for (const key in promises) {
            const promise = promises[key];
            promises[key] = await promise;
        }
    }

    // Fetches article details such as thumbnail and abstract summary
    async fetchArticleDetails(props, wiki) {
        const url = await this.wikiUrl(wiki);
        const body = await got(`${url}/api/v1/Articles/Details`, {
            searchParams: {
                // wtf
                ids: ',',
                titles: props.title
            }
        }).json();

        body.article = Object.values(body.items)[0];

        if (props.ns === 2) {
            console.log('Doing sketchy stuff with the thumbnail', body.article.thumbnail);
            body.article.thumbnail = body.article.thumbnail.split('/').slice(0, 4).join('/');
        }

        return body;
    }

    // Fetches the simplified JSON representation of the article
    async fetchArticleJson(props, wiki) {
        const url = await this.wikiUrl(wiki);
        const body = await got(`${url}/api/v1/Articles/AsSimpleJson`, {
            searchParams: {
                id: props.pageid
            }
        }).json();

        return body;
    }

    // Fetches the OpenGraph data of the article, including thumbnail and description
    async fetchArticleOpenGraph(props, wiki) {
        const url = await this.wikiUrl(wiki);
        const body = await got(`https://services.fandom.com/opengraph`, {
            searchParams: {
                uri: `${url}/wiki/${props.title}`,
            },
            cookieJar: this.jar
        }).json();

        return body;
    }

    // Fetches a variety of article data concurrently
    async fetchArticleData(props, wiki) {
        if (!props) return;

        const promiseObject = {};

        promiseObject.details = this.fetchArticleDetails(props, wiki);
        promiseObject.json = this.fetchArticleJson(props, wiki);
        promiseObject.og = this.fetchArticleOpenGraph(props, wiki);
        promiseObject.thread = this.fetchThreadData(props, wiki);

        await this.awaitPromiseObject(promiseObject);

        return promiseObject;

        return console.log('Reached end of function! Unfinished', promiseObject);

        return {
            data: details.body,
            json: json.body,
            article,
            thumbnail: og.body.imageUrl || article.thumbnail || null,
            author: thread ? {
                name: author,
                url: `https://${wiki}.wikia.com/wiki/User:${encodeURIComponent(author)}`,
                icon_url: user && user.body.items[0] && user.body.items[0].avatar
            } : undefined,
            footer: thread ? {
                text: forum ? `${placement} board` : `${placement}'s message wall`,
                icon_url: user && user.body.items[1] && user.body.items[1].avatar
            } : undefined,
            description: linker.getDescription(json.body.sections, Object.values(details.body.items)[0].abstract),
        };
    }

    getDescription(sections, ...fallbacks) {
        const first = sections
            .map(section => section.content)
            .filter(content => content && content.filter(elem => elem.type == 'paragraph' && elem.text.trim()).length)
            .map(content => content.find(elem => elem.type == 'paragraph'))
            [0];

        if (first) {
            return first.text;
        }

        return fallbacks.find(Boolean);
    }

    // Sanitizes a Discord embed structure to protect against @mentions and invite links
    // Uses [this.escape], so they're replaced with a zero-width space
    escapeEmbed(embed) {
        if (embed.title) {
            embed.title = this.escape(embed.title);
        }

        if (embed.description) {
            embed.description = this.escape(embed.description);
        }

        if (embed.fields) {
            for (const i in embed.fields) {
                const field = embed.fields[i];

                if (field.value) {
                    field.value = this.escape(field.value);
                }
            }
        }

        if (embed.author && embed.author.name) {
            embed.author.name = this.escape(embed.author.name);
        }

        if (embed.footer && embed.footer.text) {
            embed.footer.text = this.escape(embed.footer.text);
        }
    }

    async buildArticleEmbed(props, data, wiki, message) {
        console.log('Building article embed', { props, data });

        const url = await this.wikiUrl(wiki);
        const embed = {};
        const fields = [];

        const { og, json, thread, details } = data;

        embed.color = message.guild.me.displayColor;
        embed.title = props.title;
        embed.url = `${url}/wiki/${this.encode(props.title)}`;
        embed.description = this.getDescription(json.sections, details.article.abstract, og.description);

        const thumbnail = og.imageUrl || details.article.thumbnail;

        if (thumbnail) {
            embed.thumbnail = {
                url: thumbnail
            };
        }

        if (props.categories) {
            fields.push({
                name: `Categories [${props.categories.length}]`,
                value: props.categories.map(cat => this.removeNamespace(cat.title)).join(', '),
            });
        }

        if (thread) {
            embed.title = thread.threadTitle;

            embed.author = {
                name: thread.author,
                url: `${url}/wiki/User:${this.encode(thread.author)}`,
                icon_url: thread.authorAvatar
            };

            embed.footer = {
                icon_url: thread.wallAvatar,
                text: thread.isForum
                    ? `${thread.placement} board`
                    : `${thread.placement}'s wall`
            };

            embed.timestamp = thread.creation;

            if (thread.replyCount) {
                fields.push({
                    name: 'Replies',
                    value: thread.replyCount,
                    inline: true
                });
            }

            if (thread.kudos) {
                fields.push({
                    name: 'Kudos',
                    value: thread.kudos,
                    inline: true
                });
            }
        }

        if (fields.length) {
            embed.fields = fields;
        }

        this.escapeEmbed(embed);

        return embed;
    }

    async fetchArticleEmbed(segments, wiki, message) {
        const props = await this.fetchArticleProps(segments, wiki);
        if (!props) return null;

        const data = await this.fetchArticleData(props, wiki);
        if (!data) return null;

        const embed = await this.buildArticleEmbed(props, data, wiki, message);

        // console.log('Props', props);
        // console.log('Data', data);

        return {
            embed
        };
    }

    async getUrlFromParams(full, params, wiki) {
        const url = await this.wikiUrl(wiki);
        const base = `${url}/wiki/${this.encode(full)}`;
        let query = '?';

        for (const key in params) {
            if (isNaN(key)) {
                query += `${this.encode(key)}=${this.encode(params[key])}&`;
            } else {
                query += `${this.encode(params[key])}&`;
            }
        }

        if (query === '?') return `<${base}>`;

        query = query.slice(0, -1);

        return `<${base}${query}>`;
    }

    async fetchNamespaces(wiki) {
        const result = await this.api(wiki, {
            action: 'query',
            meta: 'siteinfo',
            siprop: 'namespaces|namespacealiases'
        });
        const namespaces = {};

        for (const id in result.query.namespaces) {
            const ns = result.query.namespaces[id];

            namespaces[ns['*'].toLowerCase()] = ns.id;

            if (ns.canonical) {
                namespaces[ns.canonical.toLowerCase()] = ns.id;
            }

            if (ns.hasOwnProperty('content') && !namespaces.hasOwnProperty('$default')) {
                namespaces.$default = ns.id;
            }
        }

        for (const i in result.query.namespacealiases) {
            const ns = result.query.namespacealiases[i];

            namespaces[ns['*'].toLowerCase()] = ns.id;
        }

        return namespaces;
    }

    async matchNamespace(page, wiki) {
        const namespaces = await this.namespaces.get(wiki, () => this.fetchNamespaces(wiki)),
        split = page.split(':'),
        ns = split.shift().toLowerCase();

        if (namespaces.hasOwnProperty(ns)) {
            return [namespaces[ns], split.join(':')];
        } else {
            return [namespaces.$default, page];
        }
    }

    async fetchPagesByPrefix(name, wiki) {
        console.log(name, wiki);

        const [ns, title] = await this.matchNamespace(name, wiki),
        result = await this.api(wiki, {
            action: 'query',
            list: 'allpages',
            apnamespace: ns,
            apprefix: title,
            aplimit: 5
        }),
        titles = result.query.allpages.map(page => page.title);

        console.log(ns, title);

        return this.bot.fmt.codeBlock(titles.join('\n'));
    }
}

module.exports = LinkerPlugin;

// TODO(Doru): Refactor
const linker = {
    on: {
        message: async function(msg) {
            let matches;
            const promises = [];
            const wiki = config.WIKIS[msg.guild.id] || config.WIKIS.default;

            if (matches = linker.matchLinks(msg.cleanContent)) {
                matches.forEach(match => promises.push(linker.getLink(match[1].trim(), wiki)));
            }

            if (matches = linker.matchTemplates(msg.cleanContent)) {
                matches.forEach(match => promises.push(linker.getTemplate(match, wiki, msg)));
            }

            if (matches = linker.matchSearch(msg.cleanContent)) {
                matches.forEach(match => promises.push(linker.getSearch(match[1].trim(), wiki)));
            }

            try {
                const results = await Promise.all(promises);
                const messages = results.filter(Boolean);

                const strings = messages.filter(elem => typeof elem == 'string');
                const embeds = messages.filter(elem => typeof elem != 'string');
                const sending = [];

                if (strings.length) {
                    sending.push(msg.channel.send(strings));
                }

                embeds.forEach(embed => sending.push(msg.channel.send(embed)));

                sending.forEach(promise => promise.then(async message => {
                    const [
                        reaction,
                        reactions
                    ] = await Promise.all([
                        message.react('❌'),
                        message.awaitReactions(
                            (reaction, reactor) => reactor.id == msg.author.id && reaction.emoji.name == '❌',
                            {
                                time: 60000,
                                max: 1,
                            }
                        )
                    ]);

                    if (reactions.size) {
                        message.delete();
                    } else {
                        reaction.remove();
                    }
                }));
            } catch(e) {
                console.error(e);
            }
        },
        messageUpdate: (old, cur) => {
            // TODO(Doru): Update
        }
    },
    init: async () => {
        linker.jar = new CookieJar();
        await got.post('https://services.fandom.com/auth/token', {
            form: {
                username: config.USERNAME,
                password: config.PASSWORD
            },
            cookieJar: linker.jar,
        }).json();
    },
    check: () => {
        return config.ADMINS && config.ADMINS.length;
    },
    encodeTable: {
        '20': '_'
    },
    zwsp: str => str + String.fromCharCode(8203),
    decode: str => str.replace(/%([0-9a-f]{2})/gi, (_, hex) => linker.encodeTable[hex.toLowerCase()] || String.fromCharCode(parseInt(hex, 16)) || '%' + hex),
    encodeUrl: (str) => encodeURIComponent(str)
        .replace(/%(3A|2F|20|23)/gi, linker.decode)
        .replace(/(%3F|%26)([^%]+)%3D([^%]+)/gi, (_, char, key, value) => `${linker.decode(char)}${key}=${value}`)
        .trim(),
    encode: str => str.replace(/@|discord\.gg/g, linker.zwsp),
    cleanCode: str => str
        .replace(/`{3}[\S\s]*?`{3}/gm, '')
        .replace(/`[\S\s]*?`/gm, '')
        .replace(/\u200B/g, ''),
    linkRegex: /\[\[([^\]|]+)(?:|[^\]]+)?\]\]/g,
    templateRegex: /\{\{([^}|]+)(?:|[^}]+)?\}\}/g,
    searchRegex: /--(.+?)--/g,
    // searchRegex: /--([^|]+?)--/g,
    match: (str, reg) => {
        const clean = linker.cleanCode(str),
        matches = [];
        let m;
        reg.lastIndex = 0;
        while (m = reg.exec(clean)) {
            matches.push(m);
        }
        return matches.length ? matches : null;
    },
    matchLinks: str => linker.match(str, linker.linkRegex),
    // TODO(Doru): Use loops? Maybe unneeded complexity
    matchTemplates: str => linker.match(str, linker.templateRegex),
    matchSearch: str => linker.match(str, linker.searchRegex),
    getLink: (link, wiki) => {
        link = linker.encodeUrl(link);
        if (!linker.prefixKeys) {
            linker.prefixKeys = Object.keys(linker.prefixes).sort((a, b) => b.length - a.length);
        }
        for (const key of linker.prefixKeys) {
            let fn = linker.prefixes[key];
            if (link.startsWith(`${key}:`)) {
                if (typeof fn == 'string') {
                    fn = linker.prefixes[fn];
                }
                return fn(link.split(':'), wiki);
            }
        }
        return linker.prefixes.default(link.split(':'), wiki);
    },
    getTemplate: (match, wiki, message) => {
        const template = match[1].trim();
        const args = {};
        const parts = template.split(':').map(part => part.trim());
        const split = match[0].slice(2, -2).split('|').reverse();
        const custom = parts.reduce((sum, colon) => {
            colon = colon.toLowerCase();

            const str = sum === ''
                ? colon
                : (typeof sum == 'function')
                    ? sum.prefix + ':' + colon
                    : sum + ':' + colon;

            console.log(sum, str);

            if (linker.templates[str]) {
                linker.templates[str].prefix = str;
                return linker.templates[str];
            }

            if (typeof sum == 'function') return sum;

            return str;
        }, '');
        let i = split.length,
        param = -1;
        while (i--) {
            const val = split[i];
            const s = val.split('=');
            if (s.length == 1) {
                if (++param) {
                    args[param] = val;
                }
            } else {
                args[s[0]] = s[1];
            }
        }

        if (typeof custom == 'function') {
            return custom(parts.slice(1).join(':'), args, wiki, message);
        }

        return linker.fetchPreview(wiki, parts.join(':'), message);
    },
    getSearch: (query, wiki) => {
        if (!linker.searchKeys) {
            linker.searchKeys = Object.keys(linker.searchers).sort((a, b) => b.length - a.length);
        }
        for (const key of linker.searchKeys) {
            let fn = linker.prefixes[key];
            if (query.startsWith(`${key}:`)) {
                if (typeof fn == 'string') {
                    fn = linker.prefixes[fn];
                }
                return fn(query.slice(key.length + 1), query.split(':'));
            }
        }
        return linker.getFirstSearchResult(wiki, query);
    },
    getInterwiki: wiki => wiki.split('.').reverse().map((item, i) => i == 0 ? `${item}.fandom.com` : item).join('/'),
    sj: (arr, i, char) => arr.slice(i).join(char),
    prefixes: {
        w: split => `<https://community.fandom.com/wiki/${linker.sj(split, 1, ':')}>`,
        'w:c': split => `<https://${linker.getInterwiki(split[2])}/${linker.sj(split, 3, ':')}>`,
        wp: 'wikipedia',
        wikipedia: split => `<https://en.wikipedia.org/wiki/${linker.sj(split, 1, ':')}>`,
        mw: split => `<https://mediawiki.org/wiki/${linker.sj(split, 1, ':')}>`,
        github: split => `<https://github.com/${linker.sj(split, 1, ':')}>`,
        npm: split => `<https://npmjs.com/${linker.sj(split, 1, ':')}>`,
        mdn: split => `<https://developer.mozilla.org/search?q=${linker.sj(split, 1, ':').replace(/_/g, '+')}>`,
        so: split => `<https://stackoverflow.com/search?q=${linker.sj(split, 1, ':').replace(/_/g, '+')}>`,
        g: 'google',
        google: split => `<https://google.com/search?q=${linker.sj(split, 1, ':').replace(/_/g, '+')}>`,
        default: (split, wiki) => `<https://${wiki}.fandom.com/wiki/${linker.sj(split, 0, ':')}>`,
    },
    templates: {
        w: (colon, args, _, message) => linker.fetchPreview('community', colon, message),
        'w:c': (colon, args, _, message) => linker.fetchPreview(colon.split(':')[1], colon.split(':').slice(2).join(':'), message),
        fullurl: (colon, args, wiki) => {
            const base = `https://${wiki}.fandom.com/wiki/${linker.encodeUrl(colon)}`;
            let query = '?';
            for (const key in args) {
                if (isNaN(key)) {
                    query += `${linker.encodeUrl(key)}=${linker.encodeUrl(args[key])}&`
                } else {
                    query += `${linker.encodeUrl(args[key])}&`;
                }
            }
            return `<` + base + query.slice(0, -1) + `>`;
        },
        uc: colon => linker.encode(colon.toUpperCase()),
        lc: colon => linker.encode(colon.toLowerCase()),
        special: () => 'You cannot preview special pages!',
        'special:prefixindex': (colon, args, wiki) => linker.fetchByPrefix(wiki, colon.split(':').slice(1).join(':')).then(arr => '```\n' + arr.join('\n') + '```'),
    },
    searchers: {
        'w': rest => linker.getFirstSearchResult('community', rest),
        'w:c': (_, split) => linker.getFirstSearchResult(split[2], split.slice(3).join(':')),
    },
    commands: {
        die: function(msg) {
            if (!config.ADMINS.includes(msg.author.id)) {
                return;
            }
            msg.channel.send(`I'm outta here`)
                .then(() => {
                    linker.client.destroy();
                });
        }
    },
    namespaceIds: {
        media: -2,
        special: -1,
        '': 0,
        talk: 1,
        user: 2,
        user_talk: 3,
        dev_wiki: 4,
        dev_wiki_talk: 5,
        file: 6,
        file_talk: 7,
        mediawiki: 8,
        mediawiki_talk: 9,
        template: 10,
        template_talk: 11,
        help: 12,
        help_talk: 13,
        category: 14,
        category_talk: 15,
        forum: 110,
        forum_talk: 111,
        extension: 112,
        extension_talk: 113,
        user_blog: 500,
        user_blog_comment: 501,
        blog: 502,
        blog_talk: 503,
        module: 828,
        module_talk: 829,
        message_wall: 1200,
        thread: 1201,
        message_wall_greeting: 1202,
        board: 2000,
        board_thread: 2001,
        topic: 2002,
        dev: 4,
        dev_talk: 5,
        portal: 110,
        portal_talk: 111,
        image: 6,
        image_talk: 7,
        project: 4,
        project_talk: 5
    },
    matchNamespace: page => {
        const split = page.split(':');

        if (split.length == 1) return ['', split[0]];

        const prefix = split.shift(),
        rest = split.join(':');

        return [prefix, rest];
    },
    toId: prefix => linker.namespaceIds[prefix.trim().replace(/\s/g, '_').toLowerCase()],
    fetchByPrefix: async (wiki, prefix) => {
        const [ns, trimmed] = linker.matchNamespace(prefix),
        body = await got(`https://${wiki}.wikia.com/api.php`, {
            searchParams: {
                action: 'query',
                list: 'allpages',
                apnamespace: linker.toId(ns),
                apprefix: trimmed,
                aplimit: 5,
                format: 'json',
            },
        }).json();

        return body.query.allpages.map(page => page.title);
    },
    fetchArticleDetails: async (wiki, { title, ns, pageid, missing, thread, author, placement, forum }) => {
        if (missing === '') return null;
        const [
            details,
            json,
            og,
            user
        ] = await Promise.all([
            got(`https://${wiki}.wikia.com/api/v1/Articles/Details`, {
                searchParams: {
                    ids: ',',
                    titles: title,
                },
            }).json(),
            got(`https://${wiki}.wikia.com/api/v1/Articles/AsSimpleJson`, {
                searchParams: {
                    id: pageid
                },
            }).json(),
            got(`https://services.fandom.com/opengraph`, {
                searchParams: {
                    uri: `https://${wiki}.wikia.com/wiki/${title}`,
                },
                cookieJar: linker.jar,
            }).json(),
            thread ? got(`https://${wiki}.wikia.com/api/v1/User/Details`, {
                searchParams: {
                    ids: author + (forum ? '' : ',' + placement),
                    size: 1000
                },
                json: true
            }) : null
        ]);

        const article = Object.values(details.body.items)[0];
        if (ns == 2) {
            article.thumbnail = article.thumbnail.split('/').slice(0, 4).join('/');
        }

        return {
            data: details.body,
            json: json.body,
            article,
            thumbnail: og.body.imageUrl || article.thumbnail || null,
            author: thread ? {
                name: author,
                url: `https://${wiki}.wikia.com/wiki/User:${linker.encodeUrl(author)}`,
                icon_url: user && user.body.items[0] && user.body.items[0].avatar
            } : undefined,
            footer: thread ? {
                text: forum ? `${placement} board` : `${placement}'s message wall`,
                icon_url: user && user.body.items[1] && user.body.items[1].avatar
            } : undefined,
            description: linker.getDescription(json.body.sections, Object.values(details.body.items)[0].abstract),
        };
    },
    fetchArticleCategories: async (wiki, name) => {
        const { body } = await got(`https://${wiki}.wikia.com/api.php`, {
            searchParams: {
                action: 'query',
                prop: 'categories|revisions',
                clshow: '!hidden',
                rvprop: 'timestamp',
                titles: name,
                redirects: true,
                format: 'json',
            },
            json: true,
        }),
        page = Object.values(body.query.pages)[0];
        if (page.hasOwnProperty('missing')) {
            return await linker.tryFetchThreadCategories(wiki, name);
        }
        return page;
    },
    tryFetchThreadCategories: async (wiki, name) => {
        const id = parseInt(name.split(':').slice(1).join(':'));
        if (!id) return { missing: '' };
        const { body } = await got(`https://${wiki}.wikia.com/api.php`, {
            searchParams: {
                action: 'query',
                prop: 'categories|revisions',
                clshow: '!hidden',
                rvprop: 'content|timestamp',
                pageids: id,
                redirects: true,
                format: 'json',
            },
            json: true,
        }),
        page = Object.values(body.query.pages)[0];
        console.log(page);

        if (page.hasOwnProperty('missing')) return page;

        const [
            res,
            kudos,
        ] = await Promise.all([
            got(`https://${wiki}.wikia.com/api.php`, {
                searchParams: {
                    action: 'query',
                    prop: 'revisions',
                    list: 'allpages',
                    rvdir: 'newer',
                    rvprop: 'user|timestamp',
                    pageids: id,
                    redirects: true,
                    apprefix: page.title.split(':').slice(1).join(':'),
                    apnamespace: page.ns,
                    aplimit: 'max',
                    format: 'json',
                },
                json: true,
            }),
            got(`https://${wiki}.wikia.com/wikia.php?controller=WallExternal&method=votersModal&format=html`, {
                searchParams: {
                    controller: 'WallExternal',
                    method: 'votersModal',
                    format: 'json',
                    id
                },
                json: true,
            }),
        ]);

        const match = page.revisions[0]['*'].match(/<ac_metadata\s*title="([^"]+)\s*[^>]*>\s*<\/ac_metadata>/);

        if (match) {
            page.name = match[1];
        }

        const first = Object.values(res.body.query.pages)[0];

        page.author = first.revisions[0].user;
        page.creation = first.revisions[0].timestamp;
        page.replies = res.body.query.allpages.length - 1;
        page.kudos = kudos.body.count;
        page.thread = true;
        page.forum = page.ns == 2001;
        page.placement = page.title.split('/')[0].split(':')[1];
        page.originalName = name;

        return page;
    },
    fetchArticleData: async (wiki, name) => {
        const page = await linker.fetchArticleCategories(wiki, name);
        if (!page) return {};
        const details = await linker.fetchArticleDetails(wiki, page);
        return {
            page,
            details,
        };
    },
    getDescription: (sections, fallback) => sections
        .map(section => section.content)
        .filter(content => content && content.filter(elem => elem.type == 'paragraph' && elem.text.trim()).length)
        .map(content => content.find(elem => elem.type == 'paragraph'))
        [0] || { text: fallback },
    fetchPreview: async (wiki, name, message) => {
        try {
            const {
                page,
                details
            } = await linker.fetchArticleData(wiki, name);

            if (!page || !details || page.hasOwnProperty('missing')) return null;

            const fields = [];

            if (page.categories) {
                fields.push({
                    name: `Categories [${page.categories.length}]`,
                    value: linker.encode(page.categories.map(cat => cat.title.split(':').slice(1).join(':')).join(', ')),
                    inline: true,
                });
            }

            if (page.replies) {
                fields.push({
                    name: `Replies`,
                    value: page.replies,
                    inline: true,
                });
            }

            if (page.forum) {
                fields.push({
                    name: `Kudos`,
                    value: page.kudos,
                    inline: true,
                });
            }

            return {
                embed: {
                    title: linker.encode(page.name || page.title),
                    color: message.guild.me.displayColor,
                    url: details.data.basepath + (page.thread ? `/wiki/${linker.encodeUrl(page.originalName)}` : details.article.url),
                    description: linker.encode(details.description.text.trim()),
                    author: details.author,
                    footer: details.footer,
                    timestamp: page.creation,
                    thumbnail: {
                        url: details.thumbnail,
                    },
                    fields,
                },
            };
        } catch(e) {
            console.log(e);
        }
    },
    fetchSearchResults: async (wiki, query, limit = 1) => {
        try {
            const { body } = await got(`https://${wiki}.wikia.com/api/v1/Search/List`, {
                searchParams: {
                    query,
                    // Adding a limit makes the endpoint sometimes throw a 404
                    // limit,
                    namespaces: '0'
                },
                json: true,
            });

            if (!body.items || !body.items.length) return ``;

            return body.items;
        } catch(e) {
            console.log(e);
        }
    },
    getFirstSearchResult: async (wiki, query) => {
        const pages = await linker.fetchSearchResults(wiki, query, 1);

        if (!pages) return `No search results found for \`${query}\`.`;

        const page = pages[0],
        snippet = page.snippet
            .replace(/<span class="searchmatch">(.+?)<\/span>/g, '**$1**')
            .replace(/&hellip;/g, '…')
            .trim();

        return `<${page.url}>\n${snippet}`;
    }
};
