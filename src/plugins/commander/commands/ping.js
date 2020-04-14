const Command = require('../structs/Command.js');

class PingCommand extends Command {
	constructor(bot) {
		super(bot);
		this.aliases = ['ping', 'latency', 'lag', 'hyperspeed'];

		this.DISCORD_EPOCH = 1420070400000;

		this.shortdesc = 'Pings the bot.';
		this.desc = `
					Displays bot latency.
					Calculated via websocket heartbeat and distance between message and reply creation in Discord's side.`;
		this.usages = [
			'!ping'
		];
	}

	async call(message) {
		const line = `:heartbeat: ${this.getPing()}ms`;
		const reply = await message.channel.send(line);
		const time = `:stopwatch: ${this.getSnowflakeTime(reply.id) - this.getSnowflakeTime(message.id)}ms`;
		reply.edit(`${line}\n${time}`);
	}

	getSnowflakeTime(id) {
		return new Date(Number(BigInt(id) >> 22n) + this.DISCORD_EPOCH).getTime();
	}

	getPing() {
		// TODO: client.ws.ping when updating to Discord.js 12
		return this.bot.client.ping;
	}
}

module.exports = PingCommand;
