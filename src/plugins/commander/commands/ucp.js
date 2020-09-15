const Command = require('../structs/Command.js');
const FormatterPlugin = require('../../fandomizer');
const XRay = require('x-ray');

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
		this.validStatuses = ['Ready', 'Awaiting', 'Delete', 'Blocked', 'Broken', 'Unknown'];
	}

	call(message, content) {
		if (content) {
			const x = XRay();
			let result;

			x(`https://dev.fandom.com/wiki/${content}`, {
				buttons: x('.portable-infobox .pi-item-spacing', [
					{
						name: '.pi-data-value:not(:first-child) span.wds-button'
					}
				])
			})((err, data) => {
				if (err || !data.buttons.length) result = this.linksString;
				let status = 'Unknown';

				for (const button of data.buttons) {
					if (!this.validStatuses.includes(button.name)) continue;
					status = button.name;
					result = `UCP compatibility status for ${this.bot.fmt.bold(content)} is: ${status}`;
				}

				return message.channel.send(result);
			});
		} else {
			return message.channel.send(this.linksString);
		}
	}
}

module.exports = UCPCommand;
