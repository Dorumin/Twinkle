import fs from 'fs';
import path from 'path';
import SQLite, { Database, Statement } from 'better-sqlite3';
import * as t from 'io-ts';

import Twinkle from '../../Twinkle';
import Plugin from '../../structs/Plugin';
import { ConfigProvider } from '../../structs/Config';
import { definePrivate } from '../../util/define';

const SQLConfigSchema = t.type({
    PATH: t.string
});

export default class SQLPlugin extends Plugin {
    private sqlConfig: t.TypeOf<typeof SQLConfigSchema>;
    private dbPath: string;
    public db!: Database;
    private _ready: boolean;
    public _lastHandle: string | null;
    public _currentHandle: string | null;
    private _promise: Promise<void>;
    private stream!: fs.WriteStream;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.sqlConfig = config.getOptionTyped('SQL', SQLConfigSchema, { PATH: 'sql.db' });

        this.dbPath = path.join(__dirname, '..', '..', '..', this.sqlConfig.PATH);

        fs.mkdirSync(path.dirname(this.dbPath), {
            recursive: true
        });

        definePrivate(this, 'stream',
            fs.createWriteStream(
                path.join(path.dirname(this.dbPath), 'sql.log')
            )
        );

        this._ready = false;
        this._promise = Promise.resolve();
        this._initDB();

        this._lastHandle = null;
        this._currentHandle = null;
    }

    _initDB() {
        this._ready = true;
        this.db = new SQLite(this.dbPath, {
            verbose: (statement) => this.onStatement(statement as string)
        });
    }

    ready() {
        return this._promise;
    }

    readySync<R>(fn: () => R) {
        if (this._ready) {
            return fn();
        } else {
            return this._promise.then(fn);
        }
    }

    _standardIndent(string: string) {
        const [first, ...rest] = string.split('\n');
        if (rest.length === 0) {
            return first.trimStart();
        }

        const smallestIndent = rest.reduce((max, line) => {
            const indent = line.match(/^\s*/)![0];

            if (indent.length < max) {
                return indent.length;
            } else {
                return max;
            }
        }, Infinity);

        const indented = first.trimStart() + '\n' + rest.map(line => line.slice(smallestIndent)).join('\n');

        return indented;
    }

    log(message: string) {
        this.stream.write(`${message}\n\n`);
    }

    onStatement(statement: string) {
        const cleaned = this._standardIndent(
            statement.replace(/^\s*$\n?/gm, '').trimEnd()
        );
        let log = '';

        if (this._currentHandle && this._currentHandle !== this._lastHandle) {
            this._lastHandle = this._currentHandle;

            log += `\n[${this._currentHandle}]\n`
        }

        log += cleaned;

        this.log(log);
    }

    handle(name: string) {
        return new SQLHandle(name, this);
    }
}

export class SQLHandle<SK extends string = never> {
    public name: string;
    public sql!: SQLPlugin;
    public statements: { [key in SK]: AsyncStatement };

    constructor(name: string, sql: SQLPlugin) {
        Object.defineProperty(this, 'sql', { value: sql });

        this.name = name;
        this.statements = {} as { [key in SK]: AsyncStatement };
    }

    prepare(string: string) {
        return new AsyncStatement(this, string);
    }

    with<K extends string>(key: K, statement: string, preparer?: (s: AsyncStatement) => AsyncStatement): SQLHandle<SK | K> {
        const noob = this as SQLHandle<SK | K>;

        let prepared = new AsyncStatement(this, statement);
        if (preparer) {
            prepared = preparer(prepared);
        }

        noob.statements[key] = prepared;

        return noob;
    }

    statement(key: SK): AsyncStatement {
        return this.statements[key];
    }

    exec(string: string) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.name;

            return this.sql.db.exec(string);
        });
    }

    transaction(fn: () => void) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.name;

            return this.sql.db.transaction(fn);
        });
    }
}

export class AsyncStatement {
    private string: string;
    private handle!: SQLHandle;
    private sql!: SQLPlugin;
    private st!: Statement;

    constructor(handle: SQLHandle, string: string) {
        Object.defineProperty(this, 'handle', { value: handle });
        Object.defineProperty(this, 'sql', { value: handle.sql });

        this.string = string;

        this.sql.readySync(() => {
            definePrivate(this, 'st', this.sql.db.prepare(string));
        });
    }

    run(...args: any) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.run(...args);
        });
    }

    get(...args: any) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.get(...args);
        });
    }

    all(...args: any) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.all(...args);
        });
    }

    iterate(...args: any) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.iterate(...args);
        });
    }

    columns() {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.columns();
        });
    }

    raw(enable = true) {
        this.sql.readySync(() => {
            this.st.raw(enable);
        });

        return this;
    }

    pluck(enable = true) {
        this.sql.readySync(() => {
            this.st.pluck(enable);
        });

        return this;
    }

    expand(enable = true) {
        this.sql.readySync(() => {
            this.st.expand(enable);
        });

        return this;
    }

    safeIntegers(enable = true) {
        this.sql.readySync(() => {
            this.st.safeIntegers(enable);
        });

        return this;
    }
}
