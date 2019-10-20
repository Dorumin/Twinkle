const Command = require('../structs/command.js');
const Cache = require('../../../structs/cache.js');

class HelpCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['help', 'commands', 'halp', 'h'];
        this.cache = new Cache();
        this.pageSize = 8;

        this.shortdesc = 'Displays an interactive embed listing all commands and their descriptions.';
        this.desc = 'You already seem to have a pretty good idea for how it works, yeah?';
        this.usages = [
            '!help [command]'
        ];
        this.examples = [
            '!help',
            '!help help'
        ];
    }

    async call(message, content) {
        message.delete().catch(this.bot.logger.suppress);

        if (content) {
            const command = this.bot.commander.getAlias(content.toLowerCase());

            if (!command) {
                message.author.send(`There is no existing command with the \`${content.toLowerCase()}\` alias!`);
                return;
            }

            message.author.send({
                embed: this.buildCommandEmbed(command)
            });
            return;
        }

        const listing = await message.author.send({
            embed: this.buildListingEmbed(0)
        });

        this.react(listing, '⬅', '➡');

        this.addReactionListeners(listing, message.author);
    }

    getSortedCommands() {
        return this.bot.commander.commands.array()
            .sort((a, b) => a.aliases[0].localeCompare(b.aliases[0]));
    }

    buildListingEmbed(page) { // TODO: pass commands as arg?
        const commands = this.cache.get('commands', () => this.getSortedCommands());

        return {
            title: `Command listing [${page + 1}/${Math.ceil(commands.length / this.pageSize)}]`,
            description: 'To get detailed information on a particular command, use `help <command>`!',
            fields: this.getFields(commands, page * this.pageSize)
        };
    }

    getFields(commands, offset) {
        return commands.slice(offset, offset + this.pageSize).map(this.getField);
    }

    getField(command) {
        return {
            name: `!${command.aliases[0]}`,
            value: command.shortdesc || command.desc || '*No description provided.*'
        };
    }

    buildCommandEmbed(command) {
        const fileName = this.bot.commander.commands.findKey(cmd => cmd == command);
        const fields = [];

        if (command.aliases.length > 1) {
            const field = {
                name: 'Command aliases',
                value: command.aliases.slice(1).join(', ')
            };

            fields.push(field);
        }

        if (command.usages) {
            const field = {
                name: 'Command usage',
                value: ''
            };

            for (const usage of command.usages) {
                field.value += this.formatUsage(usage) + '\n';
            }

            fields.push(field);
        }

        if (command.examples) {
            const field = {
                name: 'Examples',
                value: ''
            };

            for (const example of command.examples) {
                field.value += example + '\n';
            }

            fields.push(field);
        }

        return {
            author: {
                name: 'View command declaration',
                url: `${this.bot.config.SOURCE.URL}/tree/master/src/plugins/commander/commands/${fileName}.js`
            },
            title: `Command description: ${command.aliases[0]}`,
            description: command.desc || command.shortdesc || '*No description provided.*',
            fields
        };
    }

    formatUsage(usage) {
        return usage
            .replace(/<[^>]+>/, '**$&**')
            .replace(/\[[^\]]+\]/, '*$&*');
    }

    async addReactionListeners(message, author) {
        const commands = this.cache.get('commands', () => this.getSortedCommands());
        const page = this.cache.get(message.id, () => 0);
        const reactions = await message.awaitReactions(
            (reaction, user) => user.id == author.id && ['⬅', '➡'].includes(reaction.emoji.name),
            { time: 60000, max: 1 }
        );

        if (!reactions.size) {
            this.removeOwnReactions(message);
            return;
        }

        const reaction = reactions.first();

        switch (reaction.emoji.name) {
            case '➡':
                const pageCount = Math.ceil(commands.length / this.pageSize);
                if (page >= pageCount - 1) break;

                // if (page == pageCount - 1) {
                //     const reaction = message.reactions.get('➡');

                //     if (reaction) {
                //         reaction.remove();
                //     }
                // }

                // if (page == 0) {
                //     this.removeOwnReactions(message).then(() => {
                //         this.react(message, '⬅', '➡');
                //     });
                // }

                this.cache.set(message.id, page + 1);

                message.edit({
                    embed: this.buildListingEmbed(page + 1)
                });
                break;
            case '⬅':
                if (page <= 0) break;

                // if (page == 1) {
                //     const reaction = message.reactions.get('⬅');

                //     if (reaction) {
                //         reaction.remove();
                //     }
                // }

                this.cache.set(message.id, page - 1);

                message.edit({
                    embed: this.buildListingEmbed(page - 1)
                });
                break;
        }

        this.addReactionListeners(message, author);
    }

    removeOwnReactions(message) {
        return Promise.all(
            message.reactions
                .filter(reaction => reaction.me)
                .map(reaction => reaction.remove())
        );
    }
}

module.exports = HelpCommand;