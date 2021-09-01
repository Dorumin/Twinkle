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
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'config', { value: bot.config.SQL });

        const persistence = this.config.PERSISTENCE || {};
        this.dbPath = path.join(__dirname, '..', '..', '..', this.config.PATH);

        fs.mkdirSync(path.dirname(this.dbPath), {
            recursive: true
        });

        Object.defineProperty(this, 'stream', {
            value: fs.createWriteStream(
                path.join(path.dirname(this.dbPath), 'sql.log')
            )
        });

        switch (persistence.TYPE) {
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

    readySync(fn) {
        if (this._ready) {
            return fn();
        } else {
            return this._promise.then(fn);
        }
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
        Object.defineProperty(this, 'sql', { value: sql });

        this.name = name;
    }

    prepare(string) {
        return new AsyncStatement(this, string);
    }

    exec(string) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.name;

            return this.sql.db.exec(string);
        });
    }

    transaction(fn) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.name;

            return this.sql.db.transaction(fn);
        });
    }
}

class AsyncStatement {
    constructor(handle, string) {
        Object.defineProperty(this, 'handle', { value: handle });
        Object.defineProperty(this, 'sql', { value: handle.sql });

        this.string = string;

        this.sql.readySync(() => {
            Object.defineProperty(this, 'st', {
                value: this.sql.db.prepare(string)
            });
        });
    }

    run(...args) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.run(...args);
        });
    }

    get(...args) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.get(...args);
        });
    }

    all(...args) {
        return this.sql.readySync(() => {
            this.sql._currentHandle = this.handle.name;

            return this.st.all(...args);
        });
    }

    iterate(...args) {
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

module.exports = SQLPlugin;
