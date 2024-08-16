import { createServer, Server, Socket } from 'net';
import { unlink } from 'fs/promises';

import { Message, TextChannel } from 'discord.js';
import * as t from 'io-ts';

import Plugin from '../../structs/Plugin';
import Twinkle from '$src/Twinkle';
import { ConfigProvider } from '$src/structs/Config';
import { hideProperties } from '$src/util/define';

const IPCConfigSchema = t.type({
    SOCKET_PATH: t.string,
    CHANNEL: t.string
});
const IPCPluginConfigSchema = t.union([
    t.array(IPCConfigSchema),
    IPCConfigSchema
]);

export default class IPCPlugin extends Plugin {
    private config: t.TypeOf<typeof IPCPluginConfigSchema>;
    private ipcs: IPC[] | null;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        this.config = config.getOptionTyped('IPC', IPCPluginConfigSchema, []);
        this.ipcs = null;
    }

    async load() {
        if (Array.isArray(this.config)) {
            this.ipcs = this.config.map(cfg => new IPC(this.bot, cfg));
        } else {
            this.ipcs = [new IPC(this.bot, this.config)];
        }
    }

    async cleanup() {
        if (this.ipcs) {
            await Promise.all(this.ipcs.map(ipc => ipc.cleanup()));
        }
    }
}

class IPC {
    private bot: Twinkle;
    private config: t.TypeOf<typeof IPCConfigSchema>;

    private buffer: string;
    private connectionCount: number;
    private connections: Record<string, Socket>;
    private channel: TextChannel | null;
    private server: Server | null;

    constructor(bot: Twinkle, config: t.TypeOf<typeof IPCConfigSchema>) {
        this.bot = bot;
        this.config = config;
        hideProperties<any>(this, ['bot', 'config']);

        this.buffer = '';
        this.connections = {};
        this.connectionCount = 0;

        this.channel = null;
        this.server = null;

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
        this.channel = await this.bot.client.channels.fetch(this.config.CHANNEL) as TextChannel;
        await this.unlinkSocket();
        this.server = createServer(this.listener.bind(this)).listen(this.config.SOCKET_PATH);
    }

    async onMessage(message: Message) {
        for (const id in this.connections) {
            this.sendToSocket(this.connections[id], 'message', {
                attachments: message.attachments,
                member: message.member,
                mentions: message.mentions,
                message,
                reference: message.reference,
                user: message.author
            });
        }
    }

    listener(socket: Socket) {
        const id = this.connectionCount++;
        this.connections[id] = socket;
        socket.on('end', () => delete this.connections[id]);
        socket.on('data', this.ipcMessage.bind(this, id));
        socket.on('error', error => this.bot.reportError('IPC socket error', error));
    }

    sendToSocket(socket: Socket, type: string, data?: any) {
        socket.write(`${JSON.stringify({
            type,
            ...data
        })}\n`);
    }

    async ipcMessage(connectionId: number, buffer: string) {
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
                    await (await this.channel?.messages.fetch(message.message))?.delete();
                    break;
                case 'message':
                    this.channel?.send(message.options ?? message.content);
                    break;
                case 'ping':
                    this.sendToSocket(this.connections[connectionId], 'pong');
                    break;
            }
        }
    }

    cleanup() {
        for (const id in this.connections) {
            this.connections[id].end();
        }

        this.server?.close();
        return this.unlinkSocket();
    }
}
