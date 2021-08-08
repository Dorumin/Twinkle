const Transport = require('./Transport.js');
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const {promisify} = require('util');
const wait = promisify(setTimeout);

class DropboxTransport extends Transport {
    constructor(config) {
        super(config);

        this.delay = config.DELAY || 10000;
        this.queue = [];
        this.cache = new Map();
        this.query = new Map();
        this.db = new Dropbox({
            accessToken: config.TOKEN,
            fetch
        });
        this.saving = false;
    }

    async list() {
        const files = await this.db.filesListFolder({
            path: ''
        });

        return files.entries.map((ref) => ref.name);
    }

    async get(key, def = null) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        if (!this.query.has(key)) {
            this.query.set(key, this.db.filesDownload({
                path: `/${key}`
            }));
        }

        let file;

        try {
            file = await this.query.get(key);
        } catch(e) {
            this.cache.set(key, def);
            return def;
        }

        const result = this.toJson(file.fileBinary.toString()) || def;
        this.cache.set(key, result);

        return result;
    }

    set(key, object) {
        this.cache.set(key, object);
        return this.queueSave(key, object);
    }

    delete(key) {
        this.query.delete(key);
        this.cache.delete(key);
        return this.db.filesDelete({
            path: `/${key}`
        });
    }

    async queueSave(key) {
        if (key && !this.queue.includes(key)) {
            this.queue.push(key);
        }

        if (this.saving) return;

        this.saving = true;

        await Promise.all([
            wait(this.delay),
            this.write(key, this.cache.get(key))
        ]);

        this.saving = false;
        this.queue.shift();

        if (this.queue.length) {
            return this.queueSave();
        }
    }

    write(key, object) {
        return this.db.filesUpload({
            path: `/${key}`,
            contents: this.toBase64(object),
            mode: 'overwrite'
        });
    }

    toJson(base64) {
        const string = Buffer.from(base64, 'base64').toString();

        try {
            return JSON.parse(string);
        } catch(e) {
            console.error(e);
            return null;
        }
    }

    toBase64(object) {
        const stringified = JSON.stringify(object);
        const buffer = Buffer.from(stringified);

        return buffer.toString('base64');
    }
}

module.exports = DropboxTransport;
