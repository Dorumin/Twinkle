const { createServer } = require('net');
const fs = require('fs');
const Plugin = require('../../structs/Plugin.js');
const SOCKET_PATH = '/tmp/twinkle.sock';

class IPCPlugin extends Plugin {
    load() {
        if (this.bot.config.IPC) {
            this.bot.ipc = new IPC(this.bot);
        }
    }
}

class IPC {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.IPC;
        this.connections = {};
        this.connectionCount = 0;
        bot.client.on('ready', this.onReady.bind(this));
        bot.client.on('message', this.onMessage.bind(this));
        // TODO: This will cause Twinkle not to stop on the first CTRL+C but rather on the second.
        // This is because Node.js terminates the process if no SIGINT handlers have been defined,
        // but expects these handlers to terminate the process if they have. The right solution
        // to this is to have Twinkle clean up all resources in all plugins.
        process.on('SIGINT', this.cleanup.bind(this));
        process.on('SIGTERM', this.cleanup.bind(this));
    }

    async onReady() {
        this.channel = await this.bot.client.channels.fetch(this.config.CHANNEL);
        try {
            await fs.promises.unlink(SOCKET_PATH);
        } catch {}
        this.server = createServer(this.listener.bind(this)).listen(SOCKET_PATH);
    }

    async onMessage(message) {
        for (const id in this.connections) {
            await this.sendToSocket(this.connections[id], 'message', {
                content: message.content
            });
        }
    }

    listener(socket) {
        const id = this.connectionCount++;
        this.connections[id] = socket;
        socket.on('end', () => delete this.connections[id]);
        socket.on('data', this.ipcMessage.bind(this, id));
    }

    sendToSocket(socket, type, data) {
        socket.write(JSON.stringify({
            type,
            ...data
        }))
    }

    async ipcMessage(connectionId, buffer) {
        const message = JSON.parse(buffer.toString());
        switch (message.type) {
            case 'delete':
                const messageToDelete = await this.channel.messages.fetch(message.message);
                if (messageToDelete) {
                    await messageToDelete.delete();
                }
                break;
            case 'message':
                await this.channel.send(message.content, message.options);
                break;
            case 'ping':
                await this.sendToSocket(this.connections[connectionId], 'pong');
                break;
        }
    }

    async cleanup() {
        for (const id in this.connections) {
            this.connections[id].end();
        }
        this.server.close();
        try {
            await fs.promises.unlink(SOCKET_PATH);
        } catch {}
    }
}

module.exports = IPCPlugin;
