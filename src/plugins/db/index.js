const Plugin = require('../../structs/Plugin.js');
const DropboxTransport = require('./transports/DropboxTransport.js');
const FSTransport = require('./transports/FSTransport.js');

class DatabasePlugin extends Plugin {
    load() {
        this.bot.db = new Database(this.bot);
    }
}

class Database {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.DB;
        this.type = this.config.TYPE;
        this.transport = null;

        switch (this.type) {
            case 'dropbox':
                this.transport = new DropboxTransport(this.config);
                break;
            case 'fs':
                this.transport = new FSTransport(this.config);
                break;
            default:
                throw new Error(`Unsupported transport: ${this.type}`);
        }
    }

    list() {
        return this.transport.list();
    }

    get(key, alt) {
        return this.transport.get(key, alt);
    }

    set(key, object) {
        return this.transport.set(key, object);
    }

    delete(key) {
        return this.transport.delete(key);
    }

    extend(key, object) {
        return this.transport.extend(key, object);
    }

    push(key, ...items) {
        return this.transport.push(key, ...items);
    }
}

module.exports = DatabasePlugin;
