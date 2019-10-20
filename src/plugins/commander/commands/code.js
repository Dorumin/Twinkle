const fs = require('fs');
const got = require('got');
const path = require('path');
const readdir = require('recursive-readdir');
const Command = require('../structs/command.js');
const Cache = require('../../../structs/cache');

class CodeCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['code', 'github', 'git', 'source'];
        this.cache = new Cache();

        this.shortdesc = 'Shows statistics and a link to the bot repository.';
        this.desc = 'Displays info about the bot.\nShows statistics like stargazers, watchers, open issues, and lines of code.';
        this.usages = [
            '!code'
        ];
    }

    async call(message) {
        const [
            lines,
            info,
        ] = await Promise.all([
            this.cache.get('lines', () => this.countBotLines()),
            this.cache.get('info', () => this.getRepoInfo()),
        ]);

        const fields = [];

        if (lines) {
            fields.push({
                name: 'Lines of code',
                value: lines,
                inline: true,
            });
        }

        if (info.watchers) {
            fields.push({
                name: 'Watchers',
                value: info.watchers,
                inline: true,
            });
        }

        if (info.stars) {
            fields.push({
                name: 'Stargazers',
                value: info.stars,
                inline: true,
            });
        }

        if (info.issues) {
            fields.push({
                name: 'Open issues',
                value: info.issues,
                inline: true,
            });
        }

        if (info.forks) {
            fields.push({
                name: 'Forks',
                value: info.forks,
                inline: true,
            });
        }

        message.channel.send({
            embed: {
                author: {
                    name: info.path,
                    url: info.url,
                },
                url: info.url,
                title: `Click here to view source code on ${info.sitename}`,
                color: message.guild.me.displayColor,
                timestamp: info.lastPush.toISOString(),
                fields,
                footer: {
                    text: `${info.lastCommit.message} - ${info.lastCommit.author.name}`,
                    icon_url: info.lastCommit.author.icon
                }
            }
        });
    }

    climb(p, count) {
        while (count--) {
            p = path.dirname(p);
        }
        return p;
    }

    countBotLines() {
        const botPath = this.climb(__dirname, 3);
        return this.countLines(botPath);
    }

    async countLines(dirPath) {
        const files = await readdir(dirPath, ['.git', 'node_modules']);
        const lineCounts = await Promise.all(
            files.map(filePath => {
                return new Promise((res, rej) => {
                    fs.readFile(filePath, (err, contents) => {
                        if (err) {
                            rej(err);
                            return;
                        }

                        const match = contents.toString().match(/\n/g);

                        res(match ? match.length + 1 : 1);
                    })
                });
            })
        );

        return lineCounts.reduce((sum, count) => sum + count, 0);
    }

    async getRepoInfo() {
        const { TYPE, PATH } = this.bot.config.SOURCE,
        data = {
            // The website used's name
            sitename: null,
            // Date object for last push event
            lastPush: null,
            // Last commit object, with fields { message, author }
            lastCommit: null,
            // Repository name
            name: null,
            // Path to the repo without host
            path: null,
            // Path to the repo with host
            url: null,
            // Main repository branch
            branch: null,
            // Number of stargazers
            stars: null,
            // Number of subscribers
            watchers: null,
            // Number of open issues
            issues: null,
            // Number of forks
            forks: null,
            // Repo image or owner avatar
            icon: null,
        };

        switch (TYPE) {
            case 'github':
                const [
                    { body: repo },
                    { body: commits }
                ] = await Promise.all([
                    got(`https://api.github.com/repos/${PATH}`, {
                        json: true,
                        headers: {
                            'User-Agent': PATH
                        }
                    }),
                    got(`https://api.github.com/repos/${PATH}/commits`, {
                        json: true,
                        headers: {
                            'User-Agent': PATH
                        }
                    })
                ]);

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
                        author: {
                            name: commit.author.login,
                            icon: commit.author.avatar_url
                        },
                        message: commit.commit.message
                    };
                }

                break;
            default:
                throw new Error('Unsupported git transport');
        }

        return data;
    }
}

module.exports = CodeCommand;