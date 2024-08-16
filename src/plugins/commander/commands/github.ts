import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { promisify } from 'util';

import got from 'got';
import readdir from 'recursive-readdir';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as t from 'io-ts';

import Command from '../structs/Command';
import Cache from '../../../structs/Cache';
import FormatterPlugin from '../../fmt';
import Twinkle from '$src/Twinkle';
import { Message } from 'discord.js';
import { assert } from 'assertmin';

const wait = promisify(setTimeout);

const SourceConfigSchema = t.type({
    TYPE: t.literal('github'),
    PATH: t.string,
    URL: t.string
});

const RepoAPISchema = t.type({
    pushed_at: t.number,
    name: t.string,
    full_name: t.string,
    html_url: t.string,
    default_branch: t.string,
    stargazers_count: t.number,
    subscribers_count: t.number,
    open_issues_count: t.number,
    forks: t.number,
    owner: t.type({
        avatar_url: t.string
    })
});

const CommitsAPISchema = t.array(t.type({
    sha: t.string,
    commit: t.type({
        message: t.string
    }),
    author: t.type({
        login: t.string,
        avatar_url: t.string
    })
}));

type RepoInfo = {
    sitename: string;
    lastPush: Date;
    lastCommit: {
        sha: string;
        message: string;
        author: {
            name: string;
            icon: string;
        }
    };
    name: string;
    path: string;
    url: string;
    branch: string;
    stars: number;
    watchers: number;
    issues: number;
    forks: number;
    icon: string;
};

export default class GitHubCommand extends Command {
    private fmt: FormatterPlugin;
    private cache: Cache<string, any>;
    private config: t.TypeOf<typeof SourceConfigSchema>;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['github', 'git', 'repo', 'source', 'status'];
        this.schema = new SlashCommandBuilder();

        this.shortdesc = 'Shows statistics and a link to the bot repository.';
        this.desc = `
                    Displays info about the bot.
                    Shows statistics like stargazers, watchers, open issues, CPU usage, RAM, and lines of code.`;
        this.usages = [
            '!code'
        ];

        this.fmt = bot.loadPlugin(FormatterPlugin);
        this.cache = new Cache();
        this.config = bot.config.getOptionTyped('SOURCE', SourceConfigSchema);
    }

    fetchOperators() {
        return Promise.all(
            this.bot.operators
                .map(id => this.bot.client.users.fetch(id))
        );
    }

    async call(message: Message) {
        const [
            lines,
            info,
            cpu,
            ram
        ] = await Promise.all([
            this.cache.get('lines', () => this.countBotLines()),
            this.cache.get('info', () => this.getRepoInfo()),
            this.getCPUUsage(),
            this.getRAMInfo()
        ]);

        const fields = [];

        if (lines) {
            fields.push({
                name: 'Lines of code',
                value: String(lines),
                inline: true,
            });
        }

        fields.push({
            name: 'CPU usage',
            value: `${(100 - cpu * 100).toFixed(2)}%`,
            inline: true
        });

        fields.push({
            name: 'RAM',
            value: `${this.formatSize(ram.proc, 2)}/${this.formatSize(ram.total)}`,
            inline: true
        });

        fields.push({
            name: 'Operators',
            value: (await this.fetchOperators())
                .map(user => `${user.username}`)
                .join('\n'),
            inline: true,
        });

        if (info.watchers) {
            fields.push({
                name: 'Watchers',
                value: String(info.watchers),
                inline: true,
            });
        }

        if (info.stars) {
            fields.push({
                name: 'Stargazers',
                value: String(info.stars),
                inline: true,
            });
        }

        if (info.issues) {
            fields.push({
                name: 'Open issues',
                value: String(info.issues),
                inline: true,
            });
        }

        if (info.forks) {
            fields.push({
                name: 'Forks',
                value: String(info.forks),
                inline: true,
            });
        }

        const commitMessage = this.fmt.firstLine(info.lastCommit.message);
        const pullId = commitMessage.match(/#(\d+)/);
        const updateUrl = pullId
            ? `${info.url}/pull/${pullId[1]}`
            : `${info.url}/commit/${info.lastCommit.sha}`;

        return message.channel.send({
            embeds: [{
                author: {
                    name: info.path,
                    url: updateUrl,
                },
                url: info.url,
                title: `Click here to view source code on ${info.sitename}`,
                color: message.guild?.me?.displayColor ?? undefined,
                timestamp: info.lastPush.toISOString(),
                fields,
                footer: {
                    text: `${commitMessage} - ${info.lastCommit.author.name}`,
                    icon_url: info.lastCommit.author.icon
                }
            }]
        });
    }

    climb(p: string, count: number) {
        while (count--) {
            p = path.dirname(p);
        }
        return p;
    }

    async countBotLines() {
        const botPath = this.climb(__dirname, 3);

        await  this.countLines(botPath);
    }

    async countLines(dirPath: string): Promise<number> {
        const files = await readdir(dirPath, ['.git', 'node_modules']);
        const lineCounts = await Promise.all(
            files.map(async filePath => {
                const contents = await fs.readFile(filePath, { encoding: 'utf-8' });
                const match = contents.toString().match(/\n/g);

                return (match ? match.length + 1 : 1);
            })
        );

        return lineCounts.reduce((sum, count) => sum + count, 0);
    }

    async getRepoInfo(): Promise<RepoInfo> {
        const { TYPE, PATH } = this.config;
        const data: Partial<RepoInfo> = {};

        switch (TYPE) {
            case 'github':
                const [
                    repo,
                    commits
                ] = await Promise.all([
                    got(`https://api.github.com/repos/${PATH}`, {
                        headers: {
                            'User-Agent': PATH
                        }
                    }).json(),
                    got(`https://api.github.com/repos/${PATH}/commits`, {
                        headers: {
                            'User-Agent': PATH
                        }
                    }).json()
                ]);

                assert(RepoAPISchema.is(repo));
                assert(CommitsAPISchema.is(commits));

                data.sitename = 'GitHub';

                data.lastPush = new Date(repo.pushed_at);
                data.name = repo.name;
                data.path = repo.full_name;
                data.url = repo.html_url;
                data.branch = repo.default_branch;
                data.stars = repo.stargazers_count;
                data.watchers = repo.subscribers_count;
                data.issues = repo.open_issues_count;
                data.forks = repo.forks;
                data.icon = repo.owner.avatar_url;

                const commit = commits[0];
                if (commit) {
                    data.lastCommit = {
                        sha: commit.sha,
                        message: commit.commit.message,
                        author: {
                            name: commit.author.login,
                            icon: commit.author.avatar_url
                        },
                    };
                }

                return data as RepoInfo;

                break;
            default:
                assert.unreachable(TYPE);
        }
    }

    formatSize(bytes: number, decimals = 2, include = true) {
        if (bytes === 0) return '0 bytes';

        let k = 1024,
            sizes = [' bytes', 'kb', 'mb', 'gb', 'tb', 'pb', 'eb', 'zb', 'yb'],
            i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + (include ? sizes[i] : '')
    }

    async getCPUUsage() {
        let stats1 = this.getCPUInfo();

        await wait(500);

        let stats2 = this.getCPUInfo();

        let idle = stats2.idle - stats1.idle;
        let total = stats2.total - stats1.total;

        return idle / total;
    }

    getCPUInfo() {
        let idle = 0,
        total = 0,
        cpus = os.cpus();

        for (const cpu of cpus) {
            for (const thing in cpu.times) {
                total += cpu.times[thing as keyof typeof cpu.times];
            }

            idle += cpu.times.idle;
        }

        return {
            idle: idle / cpus.length,
            total: total / cpus.length,
        };
    }

    getRAMInfo() {
        const total = os.totalmem(),
        free = os.freemem(),
        used = total - free,
        percent = used / total * 100,
        proc = process.memoryUsage().rss;

        return {
            total,
            free,
            used,
            percent,
            proc
        };
    }
}
