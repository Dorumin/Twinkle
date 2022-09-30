const { createServer } = require('net');
const { unlink } = require('fs/promises');
const Plugin = require('../../structs/Plugin.js');

class IPCPlugin extends Plugin {
    load() {
        if (this.bot.config.IPC) {
            const ipcConfig = this.bot.config.IPC;
            if (Array.isArray(ipcConfig)) {
                this.bot.ipc = ipcConfig.map(c => new IPC(this.bot, c));
            } else {
                this.bot.ipc = [new IPC(this.bot, ipcConfig)];
            }
        }
    }

    async cleanup() {
        if (this.bot.ipc) {
            await Promise.all(this.bot.ipc.map(i => i.cleanup()));
        }
    }
}

class IPC {
    constructor(bot, config) {
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'config', { value: config });

        this.connections = {};
        this.connectionCount = 0;
        this.buffer = '';

        bot.listen('ready', this.onReady, this);
        bot.listen('messageCreate', this.onMessage, this);
    }

    async unlinkSocket() {
        if (typeof this.config.SOCKET_PATH === 'string') {
            try {
                await unlink(this.config.SOCKET_PATH);
            } catch {}
        }
    }

    async onReady() {
        this.channel = await this.bot.client.channels.fetch(this.config.CHANNEL);
        await this.unlinkSocket();
        this.server = createServer(this.listener.bind(this)).listen(this.config.SOCKET_PATH);
    }

    async onMessage(message) {
        for (const id in this.connections) {
            await this.sendToSocket(this.connections[id], 'message', {
                attachments: message.attachments,
                member: message.member,
                mentions: message.mentions,
                message,
                reference: message.reference,
                user: message.user
            });
        }
    }

    listener(socket) {
        const id = this.connectionCount++;
        this.connections[id] = socket;
        socket.on('end', () => delete this.connections[id]);
        socket.on('data', this.ipcMessage.bind(this, id));
        socket.on('error', error => this.bot.reportError(error));
    }

    sendToSocket(socket, type, data) {
        socket.write(`${JSON.stringify({
            type,
            ...data
        })}\n`);
    }

    async ipcMessage(connectionId, buffer) {
        for (let chunk of buffer.toString().split('\n')) {
            if (!chunk.startsWith('{')) {
                chunk = `${this.buffer}${chunk}`;
            }
            if (!chunk.endsWith('}')) {
                this.buffer = chunk;
                continue;
            }
            const message = JSON.parse(chunk);
            switch (message.type) {
                case 'delete':
                    try {
                        await (await this.channel.messages.fetch(message.message)).delete();
                    } catch {}
                    break;
                case 'message':
                    return this.channel.send(message.content, message.options);
                case 'ping':
                    return this.sendToSocket(this.connections[connectionId], 'pong');
            }
        }
    }

    cleanup() {
        for (const id in this.connections) {
            this.connections[id].end();
        }

        this.server.close();
        return this.unlinkSocket();
    }
}

module.exports = IPCPlugin;
