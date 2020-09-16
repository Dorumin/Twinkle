const Command = require('../structs/Command.js');
const FormatterPlugin = require('../../fandomizer');
const got = require('got');

class UCPCommand extends Command {

	static get deps() {
		return [
			FormatterPlugin
		];
	}

	constructor(bot) {
		super(bot);
		this.aliases = ['ucp'];

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
		if (content) {
			const pageContent = await got('https://dev.fandom.com/wiki/DEV:UCP?action=raw').text();
			const line = pageContent.split('\n').find(line => line.slice(0, 7 + content.length) === `{{/row|${content}`);
			let result;

			if (line) {
				const [_, name, status, reason] = line.slice(2, -2).split('|');

				result = [
					`UCP compatibility status for ${name} is: ${status || 'Unknown'}.`,
					reason && reason.length ? `Reason: ${reason}.` : ''
				].join('\n');
			} else {
				result = this.linksString;
			}

			return message.channel.send(result);
		} else {
			return message.channel.send(this.linksString);
		}
	}
}

module.exports = UCPCommand;
