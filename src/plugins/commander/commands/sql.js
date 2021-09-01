const got = require('got');
const { table, getBorderCharacters } = require('table');
const { MessageAttachment } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const OPCommand = require('../structs/OPCommand.js');
const FormatterPlugin = require('../../fmt');
const SQLPlugin = require('../../sql');

class SQLCommand extends OPCommand {
    static get deps() {
        return [
            SQLPlugin,
            FormatterPlugin
        ];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['sql'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('The query to run against SQLite')
                    .setRequired(true)
            );

        this.hidden = true;
        this.shortdesc = `Evaluates a SQL query.`;
        this.desc = `
                    Runs one or more SQL queries.
                    If you use more than one query, then don't expect a result.
                    You need to be a bot operator to use this command.`;
        this.usages = [
            '!sql <query>',
            '!sql <sql code block of query>'
        ];
        this.examples = [
            '!sql SELECT * FROM commander_prefixes',
            '!sql ```sql\nSELECT * FROM sqlite_master;```'
        ];

        this.sql = this.bot.sql.handle('sql command');
    }

    async getCode(message, content) {
        if (message.attachments.size !== 0) {
            const file = message.attachments.first();
            const ext = file.name.split('.').pop();

            if (ext === 'sql' || ext === 'txt') {
                const code = await got(file.url).text();

                return code;
            }
        }

        let code = content;

        // Strip code block
        if (code.startsWith('```') && code.endsWith('```')) {
            code = code.slice(3, -3);

            // If sql was one of the first lines, strip it
            const firstLine = code.split('\n', 1)[0];
            if (['sql'].includes(firstLine)) {
                code = code.replace(/^.+/, '');
            }
        }

        return code;
    }

    async execute(query) {
        await this.bot.sql.ready();

        let result;
        try {
            const statement = this.sql.prepare(query).safeIntegers();

            const columns = statement.columns();
            const rows = statement.raw().all();

            result = {
                columns,
                rows
            };
        } catch(e) {
            if (e instanceof RangeError && query.trim() !== '') {
                try {
                    this.sql.exec(query);

                    return {
                        result: undefined
                    };
                } catch(e) {
                    return {
                        error: e
                    };
                }
            } else {
                return {
                    error: e
                };
            }
        }

        return {
            result
        };
    }

    // TODO: Pagination?
    // Binary search table size to fit in 2k characters
    // Perhaps a generator with two steps, start with 1 and ^2 per step
    // until the limit is reached, and then binary search backwards
    // to find the first one with just under 2k
    inspect(rows) {
        const asciiTable = table(rows, {
            border: getBorderCharacters(
                'norc'
            )
        });

        return asciiTable;
    }

    async call(message, content) {
        const query = await this.getCode(message, content);
        const { result, error } = await this.execute(query);

        if (error) {
            await message.channel.send(
                this.bot.fmt.codeBlock('apache', `${error}`)
            );
        } else if (result) {
            const { columns, rows } = result;

            const data = [
                columns.map(col => col.name),
                ...rows
            ];

            const asciiTable = this.inspect(data);

            const codeBlock = this.bot.fmt.codeBlock(asciiTable);

            if (codeBlock.length > 2000) {
                return message.channel.send({
                    files: [
                        new MessageAttachment(
                            Buffer.from(asciiTable, 'utf8'),
                            'result.txt'
                        )
                    ]
                });
            } else {
                await message.channel.send(codeBlock);
            }
        } else {
            await message.channel.send('Query executed');
        }
    }
}

module.exports = SQLCommand;
