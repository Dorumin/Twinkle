const fs = require('fs');
const path = require('path');
const SQLite = require('better-sqlite3');

const Plugin = require('../../structs/Plugin.js');
const DropboxLayer = require('./persistence/dropbox.js');

class SQLPlugin extends Plugin {
    load() {
        this.bot.sql = new SQL(this.bot);
    }
}

class SQL {
    constructor(bot) {
        this.config = bot.config.SQL;
        this.persistence = this.config.PERSISTENCE || {};
        this.dbPath = path.join(__dirname, '..', '..', '..', this.config.PATH);

        fs.mkdirSync(path.dirname(this.dbPath), {
            recursive: true
        });

        this.stream = fs.createWriteStream(
            path.join(path.dirname(this.dbPath), 'sql.log')
        );

        switch (this.persistence.TYPE) {
            case 'dropbox':
                this.persistenceLayer = new DropboxLayer(this);
                break;
        }

        if (this.persistenceLayer) {
            this._promise = this.persistenceLayer.fetch();
            this._promise.then(() => {
                this._initDB();
            });
        } else {
            this._promise = Promise.resolve();
            this._initDB();
        }

        this._lastHandle = null;
        this._currentHandle = null;
    }

    _initDB() {
        this._ready = true;
        this.db = new SQLite(this.dbPath, {
            verbose: this.onStatement.bind(this)
        });
    }

    ready() {
        return this._promise;
    }

    _standardIndent(string) {
        const [first, ...rest] = string.split('\n');
        if (rest.length === 0) {
            return first.trimStart();
        }

        const smallestIndent = rest.reduce((max, line) => {
            const indent = line.match(/^\s*/)[0];

            if (indent.length < max) {
                return indent.length;
            } else {
                return max;
            }
        }, Infinity);

        const indented = first.trimStart() + '\n' + rest.map(line => line.slice(smallestIndent)).join('\n');

        return indented;
    }

    log(message) {
        this.stream.write(`${message}\n\n`);
    }

    onStatement(statement) {
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

        this.persist();
    }

    persist(force = false) {
        if (!this.persistenceLayer) return;

        return this.persistenceLayer.persist(this.db, force);
    }

    async flush() {
        if (!this.persistenceLayer) return;

        this.persistenceLayer.stop();

        await this.persistenceLayer.persist(this.db, true);
    }

    handle(name) {
        return new SQLHandle(name, this);
    }
}

class SQLHandle {
    constructor(name, sql) {
        this.name = name;
        this.sql = sql;
    }

    prepare(string) {
        return new AsyncStatement(this, string);
    }

    async exec(string) {
        await this.sql.ready();

        this.sql._currentHandle = this.name;

        return this.sql.db.exec(string);
    }

    async transaction(fn) {
        await this.sql.ready();

        return this.sql.db.transaction(fn);
    }
}

class AsyncStatement {
    constructor(handle, string) {
        this.handle = handle;
        this.sql = handle.sql;
        this.string = string;

        this.sql.ready().then(() => {
            this.st = this.sql.db.prepare(string);
        });
    }

    async run(...args) {
        await this.sql.ready();

        this.sql._currentHandle = this.handle.name;

        return this.st.run(...args);
    }

    async get(...args) {
        await this.sql.ready();

        this.sql._currentHandle = this.handle.name;

        return this.st.get(...args);
    }

    async all(...args) {
        await this.sql.ready();

        this.sql._currentHandle = this.handle.name;

        return this.st.all(...args);
    }

    async iterate(...args) {
        await this.sql.ready();

        this.sql._currentHandle = this.handle.name;

        return this.st.iterate(...args);
    }

    pluck(enable = true) {
        this.sql.ready().then(() => {
            this.st.pluck(enable);
        });

        return this;
    }

    async expand(enable = true) {
        this.sql.ready().then(() => {
            this.st.expand(enable);
        });

        return this;
    }

    safeIntegers(enable = true) {
        this.sql.ready().then(() => {
            this.st.safeIntegers(enable);
        });

        return this;
    }
}

module.exports = SQLPlugin;
