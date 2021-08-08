const { createServer } = require('net');
const fs = require('fs');
const Plugin = require('../../structs/Plugin.js');

class IPCPlugin extends Plugin {
    load() {
        if (this.bot.config.IPC) {
            this.bot.ipc = new IPC(this.bot);
        }
    }
    cleanup() {
        this.bot.ipc.cleanup();
    }
}

class IPC {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.IPC;
        this.connections = {};
        this.connectionCount = 0;
        this.buffer = '';
        bot.client.on('ready', this.onReady.bind(this));
        bot.client.on('messageCreate', this.onMessage.bind(this));
    }

    async unlinkSocket() {
        if (typeof this.config.SOCKET_PATH === 'string') {
            try {
                await fs.promises.unlink(this.config.SOCKET_PATH);
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
        socket.on('error', (e) => console.error(e));
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
