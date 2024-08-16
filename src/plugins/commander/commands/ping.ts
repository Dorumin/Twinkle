import { SlashCommandBuilder } from '@discordjs/builders';
import Twinkle from '$src/Twinkle';
import OPCommand from '../structs/OPCommand';
import { Message } from 'discord.js';

const DISCORD_EPOCH = 1420070400000;

export default class PingCommand extends OPCommand {
	constructor(bot: Twinkle) {
		super(bot);
		this.aliases = ['ping', 'latency', 'lag', 'hyperspeed'];
        this.schema = new SlashCommandBuilder();

		this.shortdesc = 'Pings the bot.';
		this.desc = `
					Displays bot latency.
					Calculated via websocket heartbeat and distance between message and reply creation in Discord's side.`;
		this.usages = [
			'!ping'
		];
	}

	async call(message: Message) {
		const line = `:heartbeat: ${this.getPing()}ms`;
		const reply = await message.channel.send(line);
		const time = `:stopwatch: ${this.getSnowflakeTime(reply.id) - this.getSnowflakeTime(message.id)}ms`;
		return reply.edit(`${line}\n${time}`);
	}

	getSnowflakeTime(id: string) {
		return new Date(Number(BigInt(id) >> 22n) + DISCORD_EPOCH).getTime();
	}

	getPing() {
		return this.bot.client.ws.ping;
	}
}
