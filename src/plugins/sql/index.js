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
        this.bot = bot;
        this.config = bot.config.SQL;
        this.persistence = this.config.PERSISTENCE || {};
        this.dbPath = path.join(__dirname, '..', '..', '..', this.config.PATH);

        fs.mkdirSync(path.dirname(this.dbPath), {
            recursive: true
        });

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

    onStatement(_statement) {
        // console.log(statement);

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
        return new AsyncStatement(this.sql, string);
    }

    async exec(string) {
        await this.sql.ready();

        return this.sql.db.exec(string);
    }

    async transaction(fn) {
        await this.sql.ready();

        return this.sql.db.transaction(fn);
    }
}

class AsyncStatement {
    constructor(sql, string) {
        this.sql = sql;
        this.string = string;

        this.sql.ready().then(() => {
            this.st = this.sql.db.prepare(string);
        });
    }

    async run(...args) {
        await this.sql.ready();

        return this.st.run(...args);
    }

    async get(...args) {
        await this.sql.ready();

        return this.st.get(...args);
    }

    async all(...args) {
        await this.sql.ready();

        return this.st.all(...args);
    }

    async iterate(...args) {
        await this.sql.ready();

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
