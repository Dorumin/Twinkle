const got = require('got');
const { CookieJar } = require('tough-cookie');
const Cache = require('../../structs/Cache.js');
const Plugin = require('../../structs/Plugin.js');
let config;

class LinkerPlugin extends Plugin {
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
        this.jar = new CookieJar();
        this.loggingIn = this.login();

        this.ZWSP = String.fromCharCode(8203);
        this.LINK_REGEX = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
        this.TEMPLATE_REGEX = /\{\{([^{}|]+)(\|[^{}]*)?\}\}/g;
        this.SEARCH_REGEX = /--(.+?)--/g;

        bot.client.on('message', this.onMessage.bind(this));
    }

    async onMessage(message) {
        if (
            message.author.bot
        ) return;

        const wiki = this.getWiki(message.guild);
        const promises = this.getPromises(message, wiki);

        // linker.on.message(message);
    }

    login() {
        return got.post('https://services.fandom.com/auth/token', {
            form: true,
            json: true,
            body: {
                username: this.config.USERNAME,
                password: this.config.PASSWORD
            },
            cookieJar: this.jar
        });
    }

    getWiki(guild) {
        const wikis = this.config.WIKIS;

        if (!guild) return wikis.default;

        return wikis[guild.id] || wikis.default;
    }

    getPromises(message, wiki) {
        const promises = [];
        const cleaned = this.cleanText(message.cleanContent);

        const links = this.match(this.LINK_REGEX, cleaned);
        const templates = this.match(this.TEMPLATE_REGEX, cleaned);
        const searches = this.match(this.SEARCH_REGEX, cleaned);

        if (links.length) {
            promises.push(...this.getLinks(links, wiki));
        }

        if (templates.length) {
            promises.push(...this.getTemplates(templates, wiki));
        }

        if (searches.length) {
            promises.push(...this.getSearches(searches, wiki));
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

    match(reg, str) {
        const matches = [];
        let m;
        reg.lastIndex = 0;

        while (m = reg.exec(str)) {
            matches.push(m);
        }

        return matches;
    }

    decodeHex(str) {
        return str.replace(/%([0-9a-f]{2})/gi,
            (_, hex) => linker.encodeTable[hex.toLowerCase()] || String.fromCharCode(parseInt(hex, 16)) || '%' + hex
        );
    }

    encode(str) {
        return encodeURIComponent(str)
            // Allow :, /, " ", and # in urls
            .replace(/%(3A|2F|20|23)/gi, this.decodeHex)
            // Allow ?=s
            .replace(/(%3F|%26)([^%]+)%3D([^%]+)/gi, (_, char, key, value) => `${this.decodeHex(char)}${key}=${value}`)
            .trim();
    }

    escape(str) {
        return str.replace(/@|discord\.gg/g, `$&${this.ZWSP}`);
    }

    getLinks(links, wiki) {
        // TODO: Implement 2048 line splitting
        const embeds = [];

        console.log(links);

        embeds.push({
            embed: {
                description: links
                    .map(link => ``)
            }
        });

        return embeds;
    }

    getTemplates(templates) {
        console.log(templates);

        return [];
    }

    getSearches(searches) {
        console.log(searches);

        return [];
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
            form: true,
            json: true,
            body: {
                username: config.USERNAME,
                password: config.PASSWORD
            },
            cookieJar: linker.jar,
        });
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
        { body } = await got(`https://${wiki}.wikia.com/api.php`, {
            query: {
                action: 'query',
                list: 'allpages',
                apnamespace: linker.toId(ns),
                apprefix: trimmed,
                aplimit: 5,
                format: 'json',
            },
            json: true,
        });

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
                query: {
                    ids: ',',
                    titles: title,
                },
                json: true,
            }),
            got(`https://${wiki}.wikia.com/api/v1/Articles/AsSimpleJson`, {
                query: {
                    id: pageid
                },
                json: true
            }),
            got(`https://services.fandom.com/opengraph`, {
                query: {
                    uri: `https://${wiki}.wikia.com/wiki/${title}`,
                },
                json: true,
                cookieJar: linker.jar,

            }),
            thread ? got(`https://${wiki}.wikia.com/api/v1/User/Details`, {
                query: {
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
            query: {
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
            query: {
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

        if (page.hasOwnProperty('mising')) return page;

        const [
            res,
            kudos,
        ] = await Promise.all([
            got(`https://${wiki}.wikia.com/api.php`, {
                query: {
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
                query: {
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
                query: {
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
