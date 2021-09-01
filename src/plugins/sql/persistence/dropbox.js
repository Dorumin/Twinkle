const { promisify } = require('util');
const { writeFile } = require('fs/promises');
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const wait = promisify(setTimeout);

class DropboxLayer {
    constructor(sql) {
        Object.defineProperty(this, 'sql', { value: sql });
        Object.defineProperty(this, 'config', { value: sql.config.PERSISTENCE });
        Object.defineProperty(this, 'dropbox', {
            value: new Dropbox({
                accessToken: this.config.TOKEN,
                fetch
            })
        });

        this.fsPath = sql.config.PATH;
        this.dropboxPath = this.config.PATH || '/sql.db';
        this.delay = this.config.DELAY || 120000;

        // VERY IMPORTANT
        // If this is true, do not persist anything
        // You could overwrite the persisted db
        this._errored = false;
        this._stopUploads = false;
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
                        // Return here, no significant error
                        // File does not exist, so we can use a fresh db
                        // SQL creates it if it does not exist already
                        return;
                    default:
                        this._errored = true;
                        console.error(e);
                        return;
                }
            }

            // console.log('From dropbox', file);

            const buffer = file.result.fileBinary;

            await writeFile(this.sql.dbPath, buffer);
        } catch(e) {
            this._errored = true;
            console.error(e);
            console.error(e.error);
        }
    }

    async persist(db, force = false) {
        if (this.sql.bot.dev) return;
        if (this._errored) return;
        if (!force && this._queuedWrite) return;

        this._queuedWrite = true;

        if (!force) {
            await wait(this.delay);
        }

        if (force || !this._stopUploads) {
            try {
                await this.dropbox.filesUpload({
                    path: this.dropboxPath,
                    contents: db.serialize(),
                    mode: 'overwrite'
                });
            } catch(e) {
                this.sql.bot.reportError('Failure while uploading to Dropbox', e);
            }
        }

        this._queuedWrite = false;
    }

    stop() {
        this._stopUploads = true;
    }
}

module.exports = DropboxLayer;
