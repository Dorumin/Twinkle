const { SlashCommandBuilder } = require('@discordjs/builders');
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
		this.aliases = ['ucp', 'ucx', 'compat'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('script')
                    .setDescription('The script or stylesheet to check the status')
            );

		this.shortdesc = `Posts links to UCP/UCX info.`;
		this.desc = `Posts links to information about Fandom's Unified Comunity Platform/Unified Consumer Experience. You can optionally get info on a specified script/stylesheet's compatibility status by providing it as an argument.`;
		this.usages = [
			'!ucp [script/stylesheet]'
		];
		this.examples = [
			'!ucp',
			'!ucp DiscordIntegrator'
		];

		this.linksString = `
- Help - <https://c.fandom.com/Help:UCP>/<https://c.fandom.com/Help:FandomDesktop>
- Information - <https://fandom.zendesk.com/hc/articles/360044776693>
- Bugs, features, changes - <https://c.fandom.com/User:Noreplyz/UCP>
- Content compatibility information - <https://dev.fandom.com/wiki/Dev_Wiki:UCP>`;
	}

	async call(message, content) {
		if (!content) {
			return message.channel.send(this.linksString);
		}

		const pageContent = await got('https://dev.fandom.com/wiki/DEV:UCP?action=raw').text();
		const line = pageContent.split('\n').find(line => line.slice(0, 7 + content.length) === `{{/row|${content}`);

		if (line === undefined) {
			return message.channel.send(this.linksString);
		}

		const [name, status, reason] = line.slice(7, -2).split('|');
		const response = [`UCP compatibility status for ${name} is: ${this.bot.fmt.bold(status || 'Unknown')}.`];

		if (reason) {
			response.push(`${this.bot.fmt.bold('Reason')}: ${reason}`);
		}

		return message.channel.send(response.join('\n'));
	}
}

module.exports = UCPCommand;
