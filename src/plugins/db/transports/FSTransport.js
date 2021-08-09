const {readFile, readdir, unlink, mkdir, writeFile} = require('fs/promises');
const {dirname, join} = require('path');
const Transport = require('./Transport.js');
const {promisify} = require('util');
const wait = promisify(setTimeout);

class FSTransport extends Transport {
    constructor(config) {
        super(config);

        this.delay = config.DELAY || 1000;
        this.queue = [];
        this.path = config.PATH;
        this.cache = new Map();
        this.query = new Map();
        this.saving = false;
    }

    getPath(...sub) {
        return join(this.path, ...sub);
    }

    list() {
        return readdir(this.path);
    }

    async get(key, def = null) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        if (!this.query.has(key)) {
            try {
                this.query.set(key, await readFile(this.getPath(key), {
                    encoding: 'utf-8'
                }));
            } catch {
                return def;
            }
        }
        let file;

        try {
            file = await this.query.get(key);
        } catch(e) {
            this.cache.set(key, def);
            return def;
        }

        const result = this.toJson(file) || def;
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
        return unlink(this.getPath(key));
    }

    async queueSave(key) {
        if (key && !this.queue.includes(key)) {
            this.queue.push(key);
        }

        if (this.saving) return;

        this.saving = true;

        const filename = this.getPath(key);
        await mkdir(dirname(filename), {
            recursive: true
        });
        await Promise.all([
            wait(this.delay),
            writeFile(filename, this.toBase64(this.cache.get(key)))
        ]);

        this.saving = false;
        this.queue.shift();

        if (this.queue.length) {
            return this.queueSave();
        }
    }

    toJson(base64) {
        const string = Buffer.from(base64, 'base64').toString();

        try {
            return JSON.parse(string);
        } catch(e) {
            console.log(e);
            return null;
        }
    }

    toBase64(object) {
        const stringified = JSON.stringify(object);
        const buffer = Buffer.from(stringified);

        return buffer.toString('base64');
    }
}

module.exports = FSTransport;
