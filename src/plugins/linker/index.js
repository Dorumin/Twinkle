const diff = require('diff');
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
        this.dev = bot.config.ENV === 'development';
        this.config = bot.config.LINKER;
        this.replies = new Cache();
        this.namespaces = new Cache();
        this.avatars = new Cache();
        this.jar = new CookieJar();
        this.wikiVars = new Cache();
        if (this.config.USERNAME) {
            this.login().then(() => {
                console.log('Linker login success');
            }).catch(err => {
                console.error('Linker login failure');
                console.error(err);
            });
        }

        this.ZWSP = String.fromCharCode(8203);
        this.LINK_REGEX = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
        this.TEMPLATE_REGEX = /\{\{([^{}|]+)(\|[^{}]*)?\}\}/g;
        this.SEARCH_REGEX = /(?<!\w)--(\S.+?\S)--(?!\w)/g;
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
        this.addLinkTarget('so', ({ full }) => `https://stackoverflow.com/search?q=${this.encode(full, { '20': '+' })}`);
        this.addLinkTarget('mw', ({ full }) => `https://mediawiki.org/wiki/${this.encode(full)}`);
        this.addLinkTarget('jquery', ({ full }) => `https://api.jquery.com/?s=${this.encode(full, { '20': '+' })}`);

        this.addLinkTarget(['wp'], ['wikipedia'], ({ full }) => `https://en.wikipedia.org/wiki/${this.encode(full)}`);
        this.addLinkTarget(['g'], ['google'], ({ full }) => `https://www.google.com/search?q=${this.encode(full, { '20': '+' })}`);
        this.addLinkTarget(['lmgtfy'], ({ full }) => `https://lmgtfy.com/?q=${this.encode(full, { '20': '+' })}`);

        this.addLinkTarget('w', 'c', async ({ parts: [wiki, ...rest] }) => `${await this.wikiUrl(wiki)}/wiki/${this.encode(rest.join(':'))}`);
        this.addLinkTarget('w', ({ full }) => `https://community.fandom.com/wiki/${this.encode(full)}`);

        this.addLinkTarget(async ({ full, wiki }) => this.makeWikiLink(await this.wikiUrl(wiki), `/wiki/${this.encode(full)}`));

        // lol
        // this.addLinkTarget('debug', (args) => {
        //     return `https://github.com/Dorumin/Twinkle`;
        // });

        // Searching, if it can even be called that considering the quality of the results
        this.addSearchTarget('w', 'c', ({ parts: [wiki, ...rest] }) => this.fetchFirstSearchResult(rest.join(':'), wiki));
        this.addSearchTarget('w', ({ full }) => this.fetchFirstSearchResult(full, 'community'));
        this.addSearchTarget(({ full, wiki }) => this.fetchFirstSearchResult(full, wiki));

        // Special pages
        this.addTemplateTarget('special', 'prefixindex', ({ full, wiki }) => this.fetchPagesByPrefix(full, wiki));
        this.addTemplateTarget('special', 'diff', ({ parts, wiki, message }) => this.fetchDiff(parts, wiki, message));
        this.addTemplateTarget('special', () => `You can't preview special pages!`);

        // Silly utility stuff
        this.addTemplateTarget('lc', ({ full }) => full.toLowerCase());
        this.addTemplateTarget('uc', ({ full }) => full.toUpperCase());
        this.addTemplateTarget('fullurl', ({ full, params, wiki }) => this.getUrlFromParams(full, params, wiki));

        // Redirect w: and w:c:wiki paths to other template handlers
        // This strategy could be applied to the other handlers, but they're pretty simple for now
        this.addTemplateTarget('w', 'c', ({ parts: [wiki, ...rest], full, params, message }) => {
            return this.getTargetResult(this.templateTargets, rest, wiki, full.slice(wiki.length + 1), params, message);
        });
        this.addTemplateTarget('w', ({ parts, full, params, message }) => {
            return this.getTargetResult(this.templateTargets, parts, 'community', full, params, message);
        });

        // Article previews
        this.addTemplateTarget(({ full, wiki, message }) => this.fetchArticleEmbed(full, wiki, message));

        // Debugging
        // this.addTemplateTarget('debug', (args) => {
        //     return this.bot.fmt.codeBlock('json', JSON.stringify(args, (k, v) => {
        //         if (k === 'message') return { cyclic: true };
        //         if (k === 'params' && this.hasStringKeys(v)) return Object.assign({}, v);
        //         return v;
        //     }, 2));
        // });

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

        if (this.dev && this.bot.config.DEV.GUILD !== message.guild.id) return;

        const wiki = await this.getWiki(message.guild);
        const promises = this.getPromises(message, wiki);
        const results = await Promise.all(promises);

        for (let result of results) {
            if (!result) continue;

            // if (typeof result === 'string') {
            //     result = this.killMentions(result, message);
            // }

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
            headers: {
                'X-Wikia-WikiaAppsID': '69'
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
        const cleaned = this.cleanText(message.content);

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
        return this.stripBlockQuotes(str)
            // Code blocks, ```a```, ``b``, `c`
            .replace(/(`{1,3})[\S\s]+?\1/gm, '')
            // Zero width spaces
            .replace(/\u200B/g, '');
    }

    // Totally necessary regexless version to strip blockquotes from a message
    stripBlockQuotes(str) {
        const indices = [];
        let i = 0;
        while (true) {
            const next = str.indexOf('\n', i + 1);

            if (str.slice(i, i + 2) === '> ') {
                if (next === -1) {
                    indices.push([i, str.length]);
                } else {
                    indices.push([i, next + 1]);
                }
            } else if (str.slice(i, i + 4) === '>>> ') {
                indices.push([i, str.length]);
                break;
            }

            if (next === -1) break;

            i = next + 1;
        }

        if (indices.length === 0) return str;

        let s = '';
        let j = 0;
        for (let [start, end] of indices) {
            s += str.slice(j, start);
            j = end;
        }
        s += str.slice(j, str.length);

        return s;
    }

    // TODO: straight outta Discord.js, will most likely need updating
    killMentions(text, message) {
        if (!text) return text;

        return text
            .replace(/<@!?[0-9]+>/g, input => {
                const id = input.replace(/<|!|>|@/g, '');
                if (message.channel.type === 'dm' || message.channel.type === 'group') {
                    return message.client.users.cache.has(id) ? `@${message.client.users.cache.get(id).username}` : input;
                }

                const member = message.channel.guild.members.cache.get(id);
                if (member) {
                    if (member.nickname) return `@${member.nickname}`;
                    return `@${member.user.username}`;
                } else {
                    const user = message.client.users.cache.get(id);
                    if (user) return `@${user.username}`;
                    return input;
                }
            })
            .replace(/<#[0-9]+>/g, input => {
                const channel = message.client.channels.cache.get(input.replace(/<|#|>/g, ''));
                if (channel) return `#${channel.name}`;
                    return input;
                })
            .replace(/<@&[0-9]+>/g, input => {
                if (message.channel.type === 'dm' || message.channel.type === 'group') return input;
                const role = message.guild.roles.cache.get(input.replace(/<|@|>|&/g, ''));
                if (role) return `@${role.name}`;
                return input;
            });
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

    makeWikiLink(domain, path) {
        const url = new URL(domain + path);

        if (url.hash.length !== 0) {
            url.hash = '#' + this.sanitizeHash(url.hash.slice(1));
        }

        return url.toString();
    }

    sanitizeHash(hash) {
        // Valid hashname characters: ., -, _, :, \d, A-z
        const sanitized = hash
            .replace(/%([0-9a-zA-Z]{2})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
            .replace(/[^0-9a-zA-Z\.\_\-\:]/g, char => `.${char.charCodeAt(0).toString(16).toUpperCase()}`);

        return sanitized;
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

    getTargetResult(targets, segments, wiki, source, params, message) {
        source = source || segments.join(':');

        let i = targets.length;
        let len = 0;

        targetsLoop:
        while (i--) {
            const [ prefixes, callback ] = targets[i];

            let j = prefixes.length;
            while (j--) {
                if (!segments[j]) continue targetsLoop;
                if (segments[j].toLowerCase() !== prefixes[j]) continue targetsLoop;
                len += segments[j].length + 1;
            }

            const sliced = segments.slice(prefixes.length);

            return callback({
                full: source.slice(len),
                parts: sliced,
                wiki,
                params,
                message
            });
        }
    }

    getLinks(links, wiki, message) {
        // TODO: Implement 2000/2048 line splitting
        const embeds = [];

        const shouldEmbed = links.some(match => match[2]);
        const hyperLinks = Promise.all(
            links
                .map(match => this.getLink(match, wiki, message))
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

    async getLink(match, wiki, message) {
        const linked = this.killMentions(match[1], message),
        display = this.killMentions(match[2], message),
        segments = linked.split(':').map(seg => seg.trim());

        const url = await this.getTargetResult(this.linkTargets, segments, wiki);

        if (display) {
            return this.bot.fmt.link(display, url);
        }

        return `<${this.bot.fmt.link(url)}>`;
    }

    getSearches(searches, wiki, message) {
        const results = [];

        const searchResults = Promise.all(
            searches
                .map(match => this.getSearch(match, wiki, message))
        );

        results.push(
            searchResults.then(result => {
                return result.join('\n');
            })
        );

        return results;
    }

    async getSearch(match, wiki, message) {
        const searched = this.killMentions(match[1], message),
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
        segments = name.split(/:|\//);

        const result = await this.getTargetResult(this.templateTargets, segments, wiki, name, params, message);

        return result;
    }

    async fetchSearchResults(query, wiki) {
        const wikiVars = await this.wikiVars.get(wiki, () => this.fetchWikiVariables(wiki));
        const body = await got(`https://services.fandom.com/unified-search/page-search`, {
            searchParams: {
                query,
                lang: wikiVars.wgLanguageCode,
                limit: 1,
                namespace: 0,
                wikiId: wikiVars.wgCityId
            },
        }).json();

        if (!body.results || !body.results.length) return [];

        return body.results;
    }

    async fetchWikiVariables(wiki) {
        const response = await this.api(wiki, {
            action: 'query',
            meta: 'siteinfo',
            siprop: 'variables'
        });
        const variables = {};
        for (const v of response.query.variables) {
            variables[v.id] = v['*'];
        }
        return variables;
    }

    async fetchFirstSearchResult(query, wiki) {
        const pages = await this.fetchSearchResults(query, wiki);

        if (!pages || !pages[0]) return `No search results found for ${this.bot.fmt.code(this.escape(query))}.`;

        const page = pages[0],
        snippet = page.content
            .replace(/<span class="searchmatch">(.+?)<\/span>/g, (_, text) => this.bot.fmt.bold(text))
            .replace(/&hellip;/g, '...')
            .trim();

        return {
            url: page.url,
            snippet: this.escape(snippet)
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

    async fetchArticleProps(title, wiki) {
        const result = await this.api(wiki, {
            action: 'query',
            prop: 'categories|revisions',
            clshow: '!hidden',
            rvprop: 'timestamp',
            titles: title,
            redirects: true
        });

        if (result && result.query) {
            const page = Object.values(result.query.pages)[0];

            if (page && !page.hasOwnProperty('missing')) {
                return page;
            }
        }

        return null;
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
            body.article.thumbnail = body.article.thumbnail.split('/').slice(0, 4).join('/');
        }

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
        promiseObject.og = this.fetchArticleOpenGraph(props, wiki);

        await this.awaitPromiseObject(promiseObject);

        return promiseObject;
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
        const url = await this.wikiUrl(wiki);
        const embed = {};
        const fields = [];

        const { og, details } = data;

        embed.color = message.guild.me.displayColor;
        embed.title = props.title;
        embed.url = `${url}/wiki/${this.encode(props.title)}`;
        embed.description = [details.article.abstract, og.description].find(Boolean);

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

        if (fields.length) {
            embed.fields = fields;
        }

        this.escapeEmbed(embed);

        return embed;
    }

    async fetchArticleEmbed(title, wiki, message) {
        const props = await this.fetchArticleProps(title, wiki);
        if (!props) return null;

        const data = await this.fetchArticleData(props, wiki);
        if (!data) return null;

        const embed = await this.buildArticleEmbed(props, data, wiki, message);

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
        const [ns, title] = await this.matchNamespace(name, wiki),
        result = await this.api(wiki, {
            action: 'query',
            list: 'allpages',
            apnamespace: ns,
            apprefix: title,
            aplimit: 5
        }),
        titles = result.query.allpages.map(page => page.title);

        return this.bot.fmt.codeBlock(titles.join('\n'));
    }

    async saveRevisions(ids, revs, wiki) {
        const result = await this.api(wiki, {
            action: 'query',
            prop: 'revisions',
            rvprop: 'user|timestamp|ids|content|comment',
            revids: ids.join('|')
        });

        for (const pageid in result.query.pages) {
            const page = result.query.pages[pageid];

            for (const i in page.revisions) {
                const rev = page.revisions[i];

                rev.title = page.title;

                revs[rev.revid] = rev;
            }
        }
    }

    getDiffs(old, cur, previewedLines = 1) {
        const chunks = [];
        // Append a newline at the end because the engine thinks "line" and "line\n" are different
        // MW doesn't play nice and doesn't have a newline at the end of page contents
        const changes = diff.diffLines(old + '\n', cur + '\n');

        let index = -1;
        let previewing = -previewedLines - 1;
        let lastContent = '';
        let lastLines = -1;

        for (const i in changes) {
            const change = changes[i];
            const value = change.value.trim();
            const type = change.added
                ? 'added'
                : change.removed
                    ? 'removed'
                    : 'content';

            switch (type) {
                case 'added':
                    if (-previewing > previewedLines) {
                        index++;
                        chunks[index] = '';
                    }

                    previewing = previewedLines;

                    if (lastContent) {
                        const content = lastContent.split('\n').slice(-previewing).join('\n');
                        chunks[index] += this.bot.fmt.indent(content, 2) + '\n';
                        lastContent = '';
                    }

                    chunks[index] += this.bot.fmt.indent(value, '+ ') + '\n';
                    break;
                case 'removed':
                    if (-previewing > previewedLines) {
                        index++;
                        chunks[index] = '';
                    }

                    previewing = previewedLines;

                    if (lastContent) {
                        const content = lastContent.split('\n').slice(-previewing).join('\n');
                        chunks[index] += this.bot.fmt.indent(content, 2) + '\n';
                        lastContent = '';
                    }

                    chunks[index] += this.bot.fmt.indent(value, '- ') + '\n';
                    break;
                case 'content':
                    const split = value.split('\n');
                    const lines = split.slice(0, previewing);

                    if (chunks[index] && lastLines !== 0) {
                        chunks[index] += this.bot.fmt.indent(lines.join('\n'), 2) + '\n';
                    }

                    previewing -= split.length;

                    lastContent = value;
                    lastLines = lines.length;
                    break;
            }
        }

        return chunks;
    }

    // Fetches the diff text between two revisions
    // Special:Diff/$curid
    // Special:Diff/$oldid/$curid
    async fetchDiff(ids, wiki, message) {
        if (!ids.length) {
            return `No revision IDs to compare.`;
        }

        if (ids.some(isNaN)) {
            return `The revision IDs look off... might want to review them?`;
        }

        const revs = {};
        const cpy = ids.slice(0);
        const curid = cpy.pop();
        let oldid = cpy.pop(); // May be undefined; fetched by subsequent call if missing

        if (!curid) {
            return `No revision IDs to compare.`;
        }

        await this.saveRevisions(ids, revs, wiki);

        if (!revs[curid] || oldid && !revs[oldid]) {
            return `There don't seem to be any revisions with the provided IDs.`;
        }

        const cur = revs[curid];

        if (!oldid) {
            oldid = cur.parentid;
            await this.saveRevisions([oldid], revs, wiki);
        }

        if (!revs[oldid]) {
            return `There doesn't seem to be any revisions with the provided IDs.`;
        }

        const old = revs[oldid];

        const url = await this.wikiUrl(wiki);
        const avatar = await this.avatars.get(cur.user, () => this.fetchAvatar(cur.user));

        const diffs = this.getDiffs(old['*'], cur['*']);
        const shownDiffs = [];
        const CHARS_PER_DIFF = 3 + 4 + 1 + 3;
        const DESC_LIMIT = 2048;
        let currentLength = 0;
        for (const diff of diffs) {
            const added = diff.length + CHARS_PER_DIFF;
            if (currentLength + added > DESC_LIMIT) break;
            currentLength += added;
            shownDiffs.push(diff);
        }

        let description = '';

        if (!shownDiffs.length) {
            description = 'The diff is too big to display.';
        } else {
            for (const diff of shownDiffs) {
                description += this.bot.fmt.codeBlock('diff', diff);
            }
        }

        if (shownDiffs.length < diffs.length) {
            const skippedDiffs = diffs.length - shownDiffs.length;
            const addendum = `(+${skippedDiffs} more changes)`;
            if (description.length + addendum.length <= DESC_LIMIT) {
                description += addendum;
            }
        }

        return {
            embed: {
                title: cur.title,
                url: `${url}/?diff=${curid}&oldid=${oldid}`,
                color: message.guild.me.displayColor,
                description,
                timestamp: cur.timestamp,
                footer: {
                    icon_url: avatar,
                    text: cur.comment
                        ? `${cur.comment} - ${cur.user}`
                        : `Edited by ${cur.user}`
                }
            }
        }
    }

    async fetchAvatar(name) {
        const result = await got(`https://community.fandom.com/api/v1/User/Details`, {
            searchParams: {
                ids: name,
                size: 150
            }
        }).json();

        return result.items[0].avatar;
    }
}

module.exports = LinkerPlugin;
