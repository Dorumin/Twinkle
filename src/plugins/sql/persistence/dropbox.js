const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const { promisify } = require('util');
const { writeFile } = require('fs/promises');
const wait = promisify(setTimeout);

class DropboxLayer {
    constructor(sql) {
        this.sql = sql;
        this.fsPath = sql.config.PATH;
        this.config = sql.config.PERSISTENCE;
        this.dropboxPath = this.config.PATH || '/sql.db';
        this.delay = this.config.DELAY || 120000;

        this.dropbox = new Dropbox({
            accessToken: this.config.TOKEN,
            fetch
        });

        // VERY IMPORTANT
        // If this is true, do not persist anything
        // You could overwrite the persisted db
        this._errored = false;
    }

    async fetch() {
        try {
            let file;
            try {
                file = await this.dropbox.filesDownload({
                    path: this.dropboxPath
                });
            } catch(e) {
                switch (e.error?.error_summary) {
                    case 'path/not_found/..':
                        return;
                    default:
                        this._errored = true;
                        console.error(e);
                        return;
                }
            }

            // console.log('From dropbox', file);

            const buffer = file.result.fileBinary;

            writeFile(this.sql.dbPath, buffer);
        } catch(e) {
            this._errored = true;
            console.error(e);
            console.error(e.error);
        }
    }

    async persist(db, force = false) {
        if (this._errored) return;
        if (!force && this._queuedWrite) return;

        this._queuedWrite = true;

        if (!force) {
            await wait(this.delay);
        }

        if (force || !this._stopUploads) {
            await this.dropbox.filesUpload({
                path: this.dropboxPath,
                contents: db.serialize(),
                mode: 'overwrite'
            });
        }

        this._queuedWrite = false;
    }

    stop() {
        this._stopUploads = true;
    }
}

module.exports = DropboxLayer;
