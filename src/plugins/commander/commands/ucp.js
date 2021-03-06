const got = require('got');
const Command = require('../structs/Command.js');
const FormatterPlugin = require('../../fandomizer');

class UCPCommand extends Command {
	static get deps() {
		return [
			FormatterPlugin
		];
	}

	constructor(bot) {
		super(bot);
		this.aliases = ['ucp', 'compat'];

		this.shortdesc = `Posts links to UCP info.`;
		this.desc = `Posts links to information about Fandom's UCP platform. You can optionally get info on a specified script/stylesheet's compatibility status by providing it as an argument.`;
		this.usages = [
			'!ucp [script/stylesheet]'
		];
		this.examples = [
			'!ucp',
			'!ucp DiscordIntegrator'
		];

		this.linksString = `
- Help - <https://c.fandom.com/Help:UCP>
- Information - <https://fandom.zendesk.com/hc/articles/360044776693>
- Bugs, features, changes - <https://c.fandom.com/User:Noreplyz/UCP>
- Content compatibility information - <https://dev.fandom.com/wiki/Dev_Wiki:UCP>`;
	}

	async call(message, content) {
		if (!content) {
			await message.channel.send(this.linksString);
			return;
		}

		const pageContent = await got('https://dev.fandom.com/wiki/DEV:UCP?action=raw').text();
		const line = pageContent.split('\n').find(line => line.slice(0, 7 + content.length) === `{{/row|${content}`);

		if (line === undefined) {
			await message.channel.send(this.linksString);
			return;
		}

		const [name, status, reason] = line.slice(7, -2).split('|');
		const response = [`UCP compatibility status for ${name} is: ${this.bot.fmt.bold(status || 'Unknown')}.`];

		if (reason) {
			response.push(`${this.bot.fmt.bold('Reason')}: ${reason}`);
		}

		await message.channel.send(response.join('\n'));
	}
}

module.exports = UCPCommand;
