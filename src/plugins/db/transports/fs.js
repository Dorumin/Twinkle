const fs = require('fs');
const path = require('path');
const Transport = require('./transport.js');

class FSTransport extends Transport {
    constructor(config) {
        super(config);

        this.delay = config.DELAY || 1000;
        this.path = config.PATH;
        this.cache = new Map();
        this.query = new Map();
    }

    getPath(...sub) {
        return path.join(this.path, ...sub);
    }

    list() {
        return new Promise((res, rej) => {
            fs.readdir(this.path, (err, files) => {
                if (err) {
                    return rej(err);
                }

                res(files);
            });
        });
    }

    get(key, def = null) {
        return new Promise(async (res, rej) => {
            if (this.cache.has(key)) {
                return res(this.cache.get(key));
            }

            if (!this.query.has(key)) {
                this.query.set(key, new Promise((res, rej) => {
                    fs.readFile(this.getPath(key), (err, data) => {
                        if (err) {
                            return rej(err);
                        }

                        res(data.toString());
                    });
                }));
            }

            let file;

            try {
                file = await this.query.get(key);
            } catch(e) {
                this.cache.set(key, def);
                return res(def);
            }

            const result = this.toJson(file.fileBinary.toString()) || def;
            this.cache.set(key, result);
    
            res(result);
        });
    }

    set(key, object) {
        this.cache.set(key, object);
        this.queueSave(key, object);
    }

    delete(key) {
        return new Promise((res, rej) => {
            this.query.delete(key);
            this.cache.delete(key);

            fs.unlink(this.getPath(key), (err) => {
                if (err) {
                    return rej(err);
                }

                res();
            });
        })
    }

    async extend(key, object) {
        const val = await this.get(key);
        this.set(key, this.constructor.extend(val, object));
    }

    async push(key, ...items) {
        const arr = await this.get(key);
        this.set(key, arr.concat(items));
    }

    async queueSave(key) {
        if (key && !this.queue.includes(key)) {
            this.queue.push(key);
        }

        if (this.saving) return;

        this.saving = true;
        
        await Promise.all([
            this.wait(this.delay),
            this.write(key, this.cache.get(key))
        ]);
        
        this.saving = false;
        this.queue.shift();

        if (this.queue.length) {
            this.queueSave();
        }
    }

    write(key, object) {
        return new Promise((res, rej) => {
            fs.writeFile(this.getPath(key), this.toBase64(object), (err) => {
                if (err) {
                    return rej(err);
                }

                res();
            })
        });
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

    wait(ms) {
        return new Promise(res => setTimeout(res, ms));
    }
}

module.exports = FSTransport;