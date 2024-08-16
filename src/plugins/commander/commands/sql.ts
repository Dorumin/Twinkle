import got from 'got';
import { table } from 'table';
import { Message, MessageAttachment } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

import OPCommand from '../structs/OPCommand';
import FormatterPlugin from '../../fmt';
import SQLPlugin, { SQLHandle } from '../../sql';
import Twinkle from '$src/Twinkle';

export default class SQLCommand extends OPCommand {
    private fmt: FormatterPlugin;
    private sqlPlugin: SQLPlugin;
    private sql: SQLHandle

    constructor(bot: Twinkle) {
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

        this.fmt = bot.loadPlugin(FormatterPlugin);
        this.sqlPlugin = bot.loadPlugin(SQLPlugin);
        this.sql = this.sqlPlugin.handle('sql command');
    }

    async getCode(message: Message, content: string) {
        if (message.attachments.size !== 0) {
            const file = message.attachments.first()!;
            const ext = file.name?.split('.').pop();

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

    async execute(query: string) {
        await this.sqlPlugin.ready();

        let result;
        try {
            const statement = this.sql.prepare(query).safeIntegers();

            let columns;
            try {
                columns = await statement.columns();
            } catch(e) {
                // No value statement
            }

            if (columns) {
                const rows = await statement.raw().all() as unknown[][];

                result = {
                    columns,
                    rows
                };
            } else {
                const changes = await statement.run();

                return {
                    changes
                };
            }
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
    inspect(rows: unknown[][]) {
        const asciiTable = table(rows, {
            // Only draw the dashes below the first header
            drawHorizontalLine: (i) => i === 1,
            // No padding
            columnDefault: {
                paddingLeft: 0,
                paddingRight: 0
            },
            // Void borders except for Joins which are two spaces
            // and the joinBody which are dashes, just below the header
            border: {
                topBody: '',
                topJoin: '',
                topLeft: '',
                topRight: '',
                // When there's only one row, so no results (only columns),
                // the bottom becomes the dashed underline, not the body
                bottomBody: rows.length === 1 ? '-' : '',
                bottomJoin: rows.length === 1 ? '  ' : '',
                bottomLeft: '',
                bottomRight: '',
                bodyLeft: '',
                bodyRight: '',
                bodyJoin: '  ',
                headerJoin: '',
                joinBody: '-',
                joinLeft: '',
                joinRight: '',
                joinJoin: '  '
            }
        });

        // Remove trailing whitespace
        return asciiTable.replace(/\s+$/gm, '');
    }

    async call(message: Message, content: string) {
        const query = await this.getCode(message, content);
        const { result, changes, error } = await this.execute(query);

        if (error) {
            await message.channel.send(
                this.fmt.codeBlock('apache', `${error}`)
            );
        } else if (result) {

            const { columns, rows } = result;

            const data: unknown[][] = [
                columns.map(col => col.name),
                ...rows
            ];

            const asciiTable = this.inspect(data);

            const codeBlock = this.fmt.codeBlock(asciiTable);

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
        } else if (changes) {
            await message.channel.send(`${changes.changes} rows changed.`)
        } else {
            await message.channel.send('Query executed.');
        }
    }
}
