import diff from 'diff';
import got from 'got';
import he from 'he';
import { CookieJar } from 'tough-cookie';
import { assert } from 'assertmin';
import { Guild, Message, MessageEmbedOptions, MessageOptions, MessagePayload } from 'discord.js';
import * as t from 'io-ts';

import Twinkle from '$src/Twinkle';
import Cache from '$src/structs/Cache';
import Plugin from '$src/structs/Plugin';
import FandomizerPlugin from '../fandomizer';
import FormatterPlugin from '../fmt';
import BlacklistPlugin from '../blacklist';
import { ConfigProvider } from '$src/structs/Config';
import { hideProperties } from '$src/util/define';

const LinkerConfigSchema = t.type({
    USERNAME: t.string,
    PASSWORD: t.string,
    WIKIS: t.record(t.string, t.string)
});

const LoginApiSchema = t.type({
    access_token: t.string
});

const UserDetailsApiSchema = t.type({
    items: t.array(t.type({
        avatar: t.string
    }))
});

const RevSchema = t.type({
    user: t.string,
    comment: t.string,
    '*': t.string,
    revid: t.number,
    oldid: t.number,
    parentid: t.number,
    timestamp: t.string,
});
const RevisionsApiSchema = t.type({
    query: t.type({
        pages: t.record(t.string, t.type({
            title: t.string,
            revisions: t.array(RevSchema)
        }))
    })
});

const AllPagesApiSchema = t.type({
    query: t.type({
        allpages: t.array(t.type({
            title: t.string
        }))
    })
});

const Namespace = t.intersection([
    t.type({
        '*': t.string,
        id: t.number
    }),
    t.partial({
        canonical: t.string,
        content: t.string,
        $default: t.string
    })
]);
const NamespaceApiResultSchema = t.type({
    query: t.type({
        namespaces: t.record(t.string, Namespace),
        namespacealiases: t.record(t.string, Namespace)
    })
});

const ArticlePropsApiSchema = t.type({
    query: t.type({
        pages: t.record(t.string, t.type({
            pageid: t.number,
            ns: t.number,
            title: t.string,
            categories: t.array(t.type({
                title: t.string,
                ns: t.number
            })),
            revisions: t.array(t.type({
                timestamp: t.string
            }))
        }))
    })
});

type ArticleProps = t.TypeOf<typeof ArticlePropsApiSchema>['query']['pages'][string];

const ArticleDetailsApiSchema = t.type({
    items: t.record(t.string, t.type({
        id: t.number,
        title: t.string,
        ns: t.number,
        url: t.string,
        full_url: t.string,
        revision: t.type({
            id: t.number,
            user: t.string,
            user_id: t.number,
            timestamp: t.string
        }),
        wiki_display_name: t.string,
        type: t.string,
        abstract: t.string,
        thumbnail: t.union([t.string, t.null]),
        site_logo: t.type({
            thumbnail: t.string
        })
    }))
});

const OpenGraphApiSchema = t.partial({
    url: t.string,
    siteName: t.string,
    title: t.string,
    type: t.string,
    imageUrl: t.string,
    description: t.string,
    originalUrl: t.string,
    imageWidth: t.number,
    imageHeight: t.number
});

const SiteVariablesApiSchema = t.type({
    query: t.type({
        variables: t.array(t.type({
            id: t.string,
            '*': t.any
        }))
    })
});

const UnifiedSearchApiSchema = t.type({
    results: t.array(t.type({
        id: t.string,
        title: t.string,
        content: t.string,
        pageId: t.number,
        namespace: t.number,
        wikiId: t.number,
        sitename: t.string,
        url: t.string,
    }))
});

const ZWSP = String.fromCharCode(8203);
const LINK_REGEX = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
const TEMPLATE_REGEX = /\{\{([^{}|]+)(\|[^{}]*)?\}\}/g;
const SEARCH_REGEX = /(?<!\w)--(\S.+?\S)--(?!\w)/g;
const ENCODE_TABLE = {
    '20': '_'
};

const HEADERS = {
    'X-Fandom-Auth': '1',
    'X-Wikia-WikiaAppsID': '69'
};

type TargetResponse = string | MessagePayload | MessageOptions | null;
type TargetHandler = (
    props: { full: string, wiki: string, parts: string[], message: Message, params: string[] }
) => TargetResponse | Promise<TargetResponse>;

type Target = [string[], TargetHandler];

type TargetPrefix = string | string[];
type TargetPrefixNormal = string[];
// No variadic prefix
type TargetArgs = [TargetHandler]
    | [TargetPrefix, TargetHandler]
    | [TargetPrefix, TargetPrefix, TargetHandler]
    | [TargetPrefix, TargetPrefix, TargetPrefix, TargetHandler];

export default class LinkerPlugin extends Plugin {
    private config: t.TypeOf<typeof LinkerConfigSchema>;
    private jar: CookieJar;

    private namespaces: Cache<string, Promise<Record<string, number>>>;
    private avatars: Cache<string, Promise<string>>;
    private wikiVars: Cache<string, Promise<Record<string, any>>>;

    private linkTargets: Target[];
    private searchTargets: Target[];
    private templateTargets: Target[];

    private fmt: FormatterPlugin;
    private fandomizer: FandomizerPlugin;
    private blacklist: BlacklistPlugin;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.config = config.getOptionTyped('LINKER', LinkerConfigSchema);

        this.jar = new CookieJar();
        hideProperties<any>(this, ['jar']);

        this.namespaces = new Cache();
        this.avatars = new Cache();
        this.wikiVars = new Cache();

        this.fmt = bot.loadPlugin(FormatterPlugin);
        this.fandomizer = bot.loadPlugin(FandomizerPlugin);
        this.blacklist = bot.loadPlugin(BlacklistPlugin);

        if (this.config.USERNAME) {
            this.login().catch(async err => {
                await this.bot.reportError('Linker login failure', err);
            });
        }

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

        this.addLinkTarget(async ({ full, wiki }) => this.makeWikiLink(await this.wikiUrl(wiki) ?? 'dev', `/wiki/${this.encode(full)}`));

        // lol
        // this.addLinkTarget('debug', (args) => {
        //     return `https://github.com/Dorumin/Twinkle`;
        // });

        // Searching, if it can even be called that considering the quality of the results
        this.addSearchTarget('w', 'c', async ({ parts: [wiki, ...rest] }) => this.formatSearchResult(await this.fetchFirstSearchResult(rest.join(':'), wiki)));
        this.addSearchTarget('w', async ({ full }) => this.formatSearchResult(await this.fetchFirstSearchResult(full, 'community')));
        this.addSearchTarget(async ({ full, wiki }) => this.formatSearchResult(await this.fetchFirstSearchResult(full, wiki)));

        // Special pages
        this.addTemplateTarget('special', 'prefixindex', ({ full, wiki }) => this.fetchPagesByPrefix(full, wiki));
        this.addTemplateTarget('special', 'diff', ({ parts, wiki, message }) => this.fetchDiff(parts, wiki, message!));
        this.addTemplateTarget('special', () => `You can't preview special pages!`);

        // Silly utility stuff
        this.addTemplateTarget('lc', ({ full }) => full.toLowerCase());
        this.addTemplateTarget('uc', ({ full }) => full.toUpperCase());
        this.addTemplateTarget('fullurl', ({ full, params, wiki }) => this.getUrlFromParams(full, params, wiki));

        // Redirect w: and w:c:wiki paths to other template handlers
        // This strategy could be applied to the other handlers, but they're pretty simple for now
        this.addTemplateTarget('w', 'c', ({ parts: [wiki, ...rest], full, params, message }) => {
            return this.getTargetResult(this.templateTargets, rest, wiki, full.slice(wiki.length + 1), params, message)!;
        });
        this.addTemplateTarget('w', ({ parts, full, params, message }) => {
            return this.getTargetResult(this.templateTargets, parts, 'community', full, params, message)!;
        });

        // Article previews
        this.addTemplateTarget(({ full, wiki, message }) => this.fetchArticleEmbed(full, wiki, message));

        // Debugging
        // this.addTemplateTarget('debug', (args) => {
        //     return this.fmt.codeBlock('json', JSON.stringify(args, (k, v) => {
        //         if (k === 'message') return { cyclic: true };
        //         if (k === 'params' && this.hasStringKeys(v)) return Object.assign({}, v);
        //         return v;
        //     }, 2));
        // });

        bot.listen('messageCreate', this.onMessage, this);
    }

    hasStringKeys(arr: any[]) {
        for (const k in arr) {
            if (isNaN(Number(k))) return true;
        }

        return false;
    }

    addLinkTarget(...args: TargetArgs) {
        this.addTarget(this.linkTargets, args);
    }

    addSearchTarget(...args: TargetArgs) {
        this.addTarget(this.searchTargets, args);
    }

    addTemplateTarget(...args: TargetArgs) {
        this.addTarget(this.templateTargets, args);
    }

    addTarget(targets: Target[], args: TargetArgs) {
        const callback = args[args.length - 1] as TargetHandler;
        const prefixes: TargetPrefixNormal[] = [];

        if (args[0] instanceof Array) {
            prefixes.push(...args.slice(0, -1) as TargetPrefixNormal[]);
        } else {
            prefixes.push(args.slice(0, -1) as TargetPrefixNormal);
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

    async onMessage(message: Message) {
        if (message.author.bot) return;
        if (!message.guild) return;

        // Ignore in dev mode if outside of dev guild
        if (this.bot.onlyDev(message.guild)) return;

        // No blacklist
        if (this.blacklist.isBlacklistedUser(message.author)) return;

        const wiki = await this.getWiki(message.guild);
        const promises = this.getPromises(message, wiki);
        const results = await Promise.all(promises);
        const returnedPromises = [];

        for (let result of results) {
            if (!result) continue;

            // if (typeof result === 'string') {
            //     result = this.killMentions(result, message);
            // }

            const reply = await message.channel.send(result);

            returnedPromises.push(Promise.all([
                reply.react('❌'),
                reply.awaitReactions({
                    filter: (reaction, reactor) => reactor.id === message.author.id && reaction.emoji.name === '❌',
                    time: 60000,
                    max: 1
                }),
            ]).then(async ([reaction, reactions]) => {
                if (reactions.size) {
                    await reply.delete();
                } else {
                    try {
                        await reaction.remove();
                    } catch(e) {}
                }
            }));
        }

        return Promise.all(returnedPromises);
    }

    async login() {
        // Grab the access token from Fandom's mobile API.
        const response = await got.post('https://services.fandom.com/mobile-fandom-app/fandom-auth/login', {
            form: {
                username: this.config.USERNAME,
                password: this.config.PASSWORD
            },
            headers: HEADERS,
            cookieJar: this.jar
        }).json();
        assert(LoginApiSchema.is(response));

        // Set the access_token cookie from the grabbed response (it only sets a fandom_session cookie right now).
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 100);
        this.jar.setCookieSync(`access_token=${response.access_token}; Domain=fandom.com; Path=/; HostOnly=false; Expires=${expiry.toUTCString()}; Max-Age=15552000; Secure; HttpOnly; Version=1`, 'https://fandom.com/');

        // Verify the login works, will throw an error if it does not.
        await got.get('https://services.fandom.com/whoami', {
            cookieJar: this.jar,
            headers: HEADERS
        });
    }

    async getWiki(guild: Guild) {
        const wikis = this.config.WIKIS;

        if (!guild) return wikis.default;

        return wikis[guild.id] || wikis.default;
    }

    getPromises(message: Message, wiki: string) {
        const promises = [];
        const cleaned = this.cleanText(message.content);

        const links = this.match(LINK_REGEX, cleaned);
        const searches = this.match(SEARCH_REGEX, cleaned);
        const templates = this.match(TEMPLATE_REGEX, cleaned);

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

    cleanText(str: string) {
        return this.stripBlockQuotes(str)
            // Code blocks, ```a```, ``b``, `c`
            .replace(/(`{1,3})[\S\s]+?\1/gm, '')
            // Zero width spaces
            .replace(/\u200B/g, '');
    }

    // Totally necessary regexless version to strip blockquotes from a message
    stripBlockQuotes(str: string) {
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
    killMentions(text: string, message: Message) {
        if (!text) return text;

        return text
            .replace(/<@!?[0-9]+>/g, input => {
                const id = input.replace(/<|!|>|@/g, '');
                if (message.channel.type === 'DM') {
                    return message.client.users.cache.has(id) ? `@${message.client.users.cache.get(id)?.username}` : input;
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
                if (channel && 'name' in channel) return `#${channel.name}`;
                return input;
            })
            .replace(/<@&[0-9]+>/g, input => {
                if (message.channel.type === 'DM') return input;
                const role = message.guild?.roles.cache.get(input.replace(/<|@|>|&/g, ''));
                if (role) return `@${role.name}`;
                return input;
            });
    }

    removeNamespace(page: string | string[]) {
        if (typeof page === 'string') {
            page = page.split(':');
        }

        return page.slice(1).join(':');
    }

    async wikiUrl(wiki: string) {
        return await this.fandomizer.url(wiki);
    }

    match(reg: RegExp, str: string) {
        const matches = [];
        let m;
        reg.lastIndex = 0;

        while (m = reg.exec(str)) {
            matches.push(m);
        }

        return matches;
    }

    decodeHTML(str: string) {
        return he.decode(str, { isAttributeValue: true });
    }

    decodeHex(str: string, table: Record<string, string> = ENCODE_TABLE) {
        return str.replace(/%([0-9a-f]{2})/gi,
            (_, hex) => table[hex.toLowerCase()] || String.fromCharCode(parseInt(hex, 16)) || '%' + hex
        );
    }

    encode(str: string, table?: Record<string, string>) {
        return encodeURIComponent(str)
            // Allow :, /, " ", and # in urls
            .replace(/%(3A|2F|20|23|2C)/gi, hex => this.decodeHex(hex, table))
            // Allow ?=s
            .replace(/(%3F|%26)([^%]+)%3D([^%]+)/gi, (_, char, key, value) => `${this.decodeHex(char)}${key}=${value}`)
            .trim();
    }

    makeWikiLink(domain: string, path: string) {
        const url = new URL(domain + path);

        if (url.hash.length !== 0) {
            url.hash = '#' + this.sanitizeHash(url.hash.slice(1));
        }

        return url.toString();
    }

    sanitizeHash(hash: string) {
        // Valid hashname characters: ., -, _, :, \d, A-z
        const sanitized = hash
            .replace(/%([0-9a-zA-Z]{2})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
            .replace(/[^0-9a-zA-Z\.\_\-\:]/g, char => `.${char.charCodeAt(0).toString(16).toUpperCase()}`);

        return sanitized;
    }

    escape(str: string) {
        return String(str).replace(/@|discord\.gg/g, `$&${ZWSP}`);
    }

    // Returns a parsed parameter list
    // Takes the form of an array that can also have key-value pairs
    // Requires the initial |, and excludes everything before it (like the template name, for example)
    // ignored|param1|param2 => [param1, param2]
    // ignored|arg1=val1|param1|arg2=val2|param2 => [param1, param2, arg1=val1, arg2=val2]
    parseParams(str: string) {
        const params: string[] = [];
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
                // @ts-expect-error Man I just don't care anymore
                params[key] = value;
            }
        }

        return params;
    }

    getTargetResult(targets: Target[], segments: string[], wiki: string, source: string, params: string[], message: Message) {
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

        assert(false);
    }

    getLinks(links: RegExpExecArray[], wiki: string, message: Message) {
        // TODO: Implement 2000/2048 line splitting
        const results = [];

        const shouldEmbed = links.some(match => match[2]);
        const hyperLinks = Promise.all(
            links
                .map(match => this.getLink(match, wiki, message))
        );

        results.push(
            hyperLinks.then(links => {
                if (shouldEmbed) {
                    return {
                        embeds: [{
                            description: links.join('\n')
                        }]
                    };
                } else {
                    return links.join('\n');
                }
            })
        );

        return results;
    }

    async getLink(match: RegExpExecArray, wiki: string, message: Message) {
        const linked = this.killMentions(match[1], message);
        const display = this.killMentions(match[2], message);
        const segments = linked.split(':').map(seg => seg.trim());

        const url = await this.getTargetResult(this.linkTargets, segments, wiki, match[1], [], message);

        if (display && typeof url === 'string') {
            return this.fmt.link(display, url);
        }

        return `<${url}>`;
    }

    getSearches(searches: RegExpExecArray[], wiki: string, message: Message) {
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

    async getSearch(match: RegExpExecArray, wiki: string, message: Message) {
        const searched = this.killMentions(match[1], message),
        segments = searched.split(':').map(seg => seg.trim());

        const result = await this.getTargetResult(this.searchTargets, segments, wiki, match[1], [], message);

        if (typeof result === 'string') {
            return result;
        }

        return result;
    }

    formatSearchResult(result: { url: string, snippet: string } | string): TargetResponse {
        if (typeof result === 'string') return result;

        return `<${result.url}>\n${result.snippet}`;
    }

    getTemplates(templates: RegExpExecArray[], wiki: string, message: Message) {
        return templates.map(match => this.getTemplate(match, wiki, message));
    }

    async getTemplate(template: RegExpExecArray, wiki: string, message: Message) {
        const name = template[1],
        params = this.parseParams(template[2]),
        segments = name.split(/:|\//);

        const result = await this.getTargetResult(this.templateTargets, segments, wiki, name, params, message);

        return result;
    }

    async fetchSearchResults(query: string, wiki: string) {
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

        assert(UnifiedSearchApiSchema.is(body));

        if (!body.results || !body.results.length) return [];

        return body.results;
    }

    async fetchWikiVariables(wiki: string) {
        const response = await this.api(wiki, {
            action: 'query',
            meta: 'siteinfo',
            siprop: 'variables'
        });

        assert(SiteVariablesApiSchema.is(response));

        const variables: Record<string, any> = {};
        for (const v of response.query.variables) {
            variables[v.id] = v['*'];
        }

        return variables;
    }

    async fetchFirstSearchResult(query: string, wiki: string) {
        const pages = await this.fetchSearchResults(query, wiki);

        if (!pages || !pages[0]) return `No search results found for ${this.fmt.code(this.escape(query))}.`;

        const page = pages[0],
        snippet = page.content
            .replace(/<span class="searchmatch">(.+?)<\/span>/g, (_: string, text: string) => this.fmt.bold(text))
            .replace(/&hellip;/g, '...')
            .trim();

        return {
            url: page.url,
            snippet: this.escape(snippet)
        };
    }

    // API helper
    async api(wiki: string, params: Record<string, string | number>) {
        return await got(`${await this.wikiUrl(wiki)}/api.php`, {
            searchParams: {
                format: 'json',
                ...params
            },
        }).json();
    }

    async fetchArticleProps(title: string, wiki: string) {
        const result = await this.api(wiki, {
            action: 'query',
            prop: 'categories|revisions',
            clshow: '!hidden',
            rvprop: 'timestamp',
            titles: title,
            redirects: 'true'
        });

        assert(ArticlePropsApiSchema.is(result));

        if (result && result.query && result.query.pages) {
            const page = Object.values(result.query.pages)[0];

            if (page && ['invalid', 'missing'].every(prop => !page.hasOwnProperty(prop))) {
                return page;
            }
        }

        return null;
    }

    // Fetches article details such as thumbnail and abstract summary
    async fetchArticleDetails(props: ArticleProps, wiki: string) {
        const url = await this.wikiUrl(wiki);
        const body = await got(`${url}/api/v1/Articles/Details`, {
            searchParams: {
                // wtf
                ids: ',',
                titles: props.title
            }
        }).json();

        assert(ArticleDetailsApiSchema.is(body));

        const article = Object.values(body.items)[0];

        return article;
    }

    // Fetches the OpenGraph data of the article, including thumbnail and description
    async fetchArticleOpenGraph(props: ArticleProps, wiki: string) {
        const url = await this.wikiUrl(wiki);
        const body = await got(`https://services.fandom.com/opengraph`, {
            searchParams: {
                uri: `${url}/wiki/${props.title}`,
            },
            cookieJar: this.jar,
            headers: HEADERS
        }).json();

        assert(OpenGraphApiSchema.is(body));

        return body;
    }

    // Fetches a variety of article data concurrently
    async fetchArticleData(props: ArticleProps, wiki: string) {
        const details = this.fetchArticleDetails(props, wiki);
        const og = this.fetchArticleOpenGraph(props, wiki);

        return {
            details: await details,
            og: await og
        };
    }

    // Sanitizes a Discord embed structure to protect against @mentions and invite links
    // Uses [this.escape], so they're replaced with a zero-width space
    escapeEmbed(embed: MessageEmbedOptions) {
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

    async buildArticleEmbed(props: ArticleProps, data: Awaited<ReturnType<typeof this.fetchArticleData>>, wiki: string, message: Message) {
        const url = await this.wikiUrl(wiki);
        const embed: MessageEmbedOptions = {};
        const fields = [];

        const { og, details } = data;

        embed.color = message.guild?.me?.displayColor;
        embed.title = props.title;
        embed.url = `${url}/wiki/${this.encode(props.title)}`;
        embed.description = [details.abstract, og.description].find(Boolean);

        const thumbnail = og.imageUrl || details.thumbnail;

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

    async fetchArticleEmbed(title: string, wiki: string, message: Message) {
        const props = await this.fetchArticleProps(title, wiki);
        if (!props) return null;

        const data = await this.fetchArticleData(props, wiki);
        if (!data) return null;

        const embed = await this.buildArticleEmbed(props, data, wiki, message);

        return {
            embeds: [embed]
        };
    }

    async getUrlFromParams(full: string, params: string[], wiki: string) {
        const url = await this.wikiUrl(wiki);
        const base = `${url}/wiki/${this.encode(full)}`;
        let query = '?';

        for (const key in params) {
            if (isNaN(Number(key))) {
                query += `${this.encode(key)}=${this.encode(params[key])}&`;
            } else {
                query += `${this.encode(params[key])}&`;
            }
        }

        if (query === '?') return `<${base}>`;

        query = query.slice(0, -1);

        return `<${base}${query}>`;
    }

    async fetchNamespaces(wiki: string): Promise<Record<string, number>> {
        const result = await this.api(wiki, {
            action: 'query',
            meta: 'siteinfo',
            siprop: 'namespaces|namespacealiases'
        });
        assert(NamespaceApiResultSchema.is(result));

        const namespaces: Record<string, number> = {};

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

    async matchNamespace(page: string, wiki: string) {
        const namespaces = await this.namespaces.get(wiki, () => this.fetchNamespaces(wiki));
        const split = page.split(':');
        const ns = split[0].toLowerCase();

        if (namespaces.hasOwnProperty(ns)) {
            return [namespaces[ns], split.join(':')];
        } else {
            return [namespaces.$default, page];
        }
    }

    async fetchPagesByPrefix(name: string, wiki: string) {
        const [ns, title] = await this.matchNamespace(name, wiki);
        const result = await this.api(wiki, {
            action: 'query',
            list: 'allpages',
            apnamespace: ns,
            apprefix: title,
            aplimit: 5
        });
        assert(AllPagesApiSchema.is(result));

        const titles = result.query.allpages.map(page => page.title);

        return this.fmt.codeBlock(titles.join('\n'));
    }

    async saveRevisions(ids: string[], revs: Record<string, t.TypeOf<typeof RevSchema>>, wiki: string) {
        const result = await this.api(wiki, {
            action: 'query',
            prop: 'revisions',
            rvprop: 'user|timestamp|ids|content|comment',
            revids: ids.join('|')
        });
        assert(RevisionsApiSchema.is(result));

        for (const pageid in result.query.pages) {
            const page = result.query.pages[pageid];

            for (const i in page.revisions) {
                const rev = page.revisions[i];

                // rev.title = page.title;

                revs[rev.revid] = rev;
            }
        }

        return result;
    }

    getDiffs(old: string, cur: string, previewedLines = 1) {
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
                        chunks[index] += this.fmt.indent(content, 2) + '\n';
                        lastContent = '';
                    }

                    chunks[index] += this.fmt.indent(value, '+ ') + '\n';
                    break;
                case 'removed':
                    if (-previewing > previewedLines) {
                        index++;
                        chunks[index] = '';
                    }

                    previewing = previewedLines;

                    if (lastContent) {
                        const content = lastContent.split('\n').slice(-previewing).join('\n');
                        chunks[index] += this.fmt.indent(content, 2) + '\n';
                        lastContent = '';
                    }

                    chunks[index] += this.fmt.indent(value, '- ') + '\n';
                    break;
                case 'content':
                    const split = value.split('\n');
                    const lines = split.slice(0, previewing);

                    if (chunks[index] && lastLines !== 0) {
                        chunks[index] += this.fmt.indent(lines.join('\n'), 2) + '\n';
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
    async fetchDiff(ids: string[], wiki: string, message: Message) {
        if (!ids.length) {
            return `No revision IDs to compare.`;
        }

        if (ids.some(id => isNaN(Number(id)))) {
            return `The revision IDs look off... might want to review them?`;
        }

        const revs: Record<string, t.TypeOf<typeof RevSchema>> = {};
        const cpy = ids.slice(0);
        const curid = cpy.pop();
        let oldid = cpy.pop(); // May be undefined; fetched by subsequent call if missing

        if (!curid) {
            return `No revision IDs to compare.`;
        }

        const result = await this.saveRevisions(ids, revs, wiki);

        if (!revs[curid] || oldid && !revs[oldid]) {
            return `There don't seem to be any revisions with the provided IDs.`;
        }

        const cur = revs[curid];

        if (!oldid) {
            oldid = cur.parentid.toString();
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
                description += this.fmt.codeBlock('diff', diff);
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
            embeds: [{
                title: Object.values(result.query.pages)[0].title,
                url: `${url}/?diff=${curid}&oldid=${oldid}`,
                color: message.guild?.me?.displayColor,
                description,
                timestamp: cur.timestamp,
                footer: {
                    icon_url: avatar,
                    text: cur.comment
                        ? `${cur.comment} - ${cur.user}`
                        : `Edited by ${cur.user}`
                }
            }]
        }
    }

    async fetchAvatar(name: string) {
        const result = await got(`https://community.fandom.com/api/v1/User/Details`, {
            searchParams: {
                ids: name,
                size: 150
            }
        }).json();

        assert(UserDetailsApiSchema.is(result));

        return result.items[0].avatar;
    }
}
