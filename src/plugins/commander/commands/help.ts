import { Message, User } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as t from 'io-ts';

import CommandUtils from '../structs/CommandUtils';
import Command from '../structs/Command';
import Cache from '../../../structs/Cache';
import FormatterPlugin from '../../fmt';
import Twinkle from '$src/Twinkle';
import CommanderPlugin, { CommandCallExtraPayload } from '..';


const SourceConfigSchema = t.type({
    TYPE: t.literal('github'),
    PATH: t.string,
    URL: t.string
});

const PAGE_SIZE = 8;

export default class HelpCommand extends Command {
    private fmt: FormatterPlugin;
    private commander: CommanderPlugin;
    private cache: Cache<string, any>;
    private config: t.TypeOf<typeof SourceConfigSchema>;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['help', 'commands', 'halp', 'h'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('command')
                    .setDescription('The command to describe in specific')
            );

        this.shortdesc = `Displays an interactive embed listing all commands and their descriptions.`;
        this.desc = `You already seem to have a pretty good idea for how it works, yeah?`;
        this.usages = [
            '!help [command]'
        ];
        this.examples = [
            '!help',
            '!help help'
        ];

        this.cache = new Cache();
        this.fmt = bot.loadPlugin(FormatterPlugin);
        this.commander = bot.loadPlugin(CommanderPlugin);
        this.config = bot.config.getOptionTyped('SOURCE', SourceConfigSchema);
    }

    async call(message: Message, content: string, { interaction }: CommandCallExtraPayload) {
        const mentionedUsers = message.mentions.users;
        const target = mentionedUsers.size > 0
            ? mentionedUsers.first()!
            : message.author;

        const creator = message.author;
        const controllers = [creator];
        if (mentionedUsers.size > 0) {
            const user = mentionedUsers.first()!;
            controllers.push(user);
            content = content.replace(new RegExp(`<@!?${user.id}>`), '').trim();
        }

        if (!interaction) {
            try {
                await message.delete();
            } catch(e) {}
        }

        if (content) {
            const command = this.commander.getAlias(content.toLowerCase());

            if (!command) {
                try {
                    if (interaction) {
                        await interaction.reply({
                            content: `There is no existing command with the \`${content.toLowerCase()}\` alias!`,
                            ephemeral: true
                        });
                    } else {
                        await creator.send(`There is no existing command with the \`${content.toLowerCase()}\` alias!`);
                    }
                } catch (error) {
                    // User probably blocked DMs.
                }
                return;
            }

            try {
                if (interaction) {
                    await interaction.reply({
                        embeds: [this.buildCommandEmbed(command)],
                        ephemeral: true
                    });
                } else {
                    await target.send({
                        embeds: [this.buildCommandEmbed(command)]
                    });
                }
            } catch (error) {
                if (interaction) {
                    await interaction.reply({
                        content: mentionedUsers.size > 0
                            ? `Couldn't send a message to their DMs, they probably have DMs disabled.`
                            : `Couldn't send a message to your DMs, you probably have DMs disabled.`,
                        ephemeral: true
                    });
                }
            }
            return;
        }

        const listing = await target.send({
            embeds: [this.buildListingEmbed(0)]
        });

        if (interaction) {
            await interaction.reply({
                content: mentionedUsers.size > 0
                    ? `Sent a command listing to their DMs.`
                    : `Sent a command listing to your DMs.`,
                ephemeral: true
            });
        }

        await CommandUtils.react(listing, '⬅', '➡');

        return this.addReactionListeners(listing, controllers);
    }

    getSortedCommands() {
        return Array.from(this.commander.commands.values())
            .sort((a, b) => a.aliases[0].localeCompare(b.aliases[0]));
    }

    buildListingEmbed(page: number) {
        const commands = this.cache.get('commands', () => this.getSortedCommands());

        return {
            title: `Command listing [${page + 1}/${Math.ceil(commands.length / PAGE_SIZE)}]`,
            description: 'To get detailed information on a particular command, use `!help <command>`',
            fields: this.getFields(commands, page * PAGE_SIZE)
        };
    }

    getFields(commands: Command[], offset: number) {
        return commands.slice(offset, offset + PAGE_SIZE).map(this.getField.bind(this));
    }

    getField(command: Command) {
        return {
            name: `!${command.aliases[0]}`,
            value: this.fmt.firstLine(command.shortdesc || command.desc || '*No description provided.*')
        };
    }

    buildCommandEmbed(command: Command) {
        const fileName = Array.from(this.commander.commands.entries()).find(([file, cmd]) => cmd == command)![0];
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
                name: 'View command declaration </>',
                url: `${this.config.URL}/tree/master/src/plugins/commander/commands/${fileName}.js`
            },
            title: `Command description: ${command.aliases[0]}`,
            description: this.fmt.trimLines(command.desc || command.shortdesc || '*No description provided.*'),
            fields
        };
    }

    formatUsage(usage: string) {
        return usage
            .replace(/<[^>]+>/, '**$&**')
            .replace(/\[[^\]]+\]/, '*$&*');
    }

    async addReactionListeners(message: Message, controllers: User[]) {
        const commands = this.cache.get('commands', () => this.getSortedCommands());
        const page = this.cache.get(message.id, () => 0);
        const reactions = await message.awaitReactions({
            filter: (reaction, user) => controllers.some(controller => controller.id === user.id) && ['⬅', '➡'].includes(reaction?.emoji.name ?? ''),
            time: 60000,
            max: 1
        });

        if (!reactions.size) {
            try {
                await CommandUtils.clearReactions(message);
            } catch (error) {
                // We are in DM and can't do this.
            }
            return;
        }

        const reaction = reactions.first();

        switch (reaction?.emoji.name) {
            case '➡':
                const pageCount = Math.ceil(commands.length / PAGE_SIZE);
                if (page >= pageCount - 1) break;

                // if (page == pageCount - 1) {
                //     const reaction = message.reactions.get('➡');

                //     if (reaction) {
                //         reaction.remove();
                //     }
                // }

                // if (page == 0) {
                //     CommandUtils.clearReactions(message).then(() => {
                //         CommandUtils.react(message, '⬅', '➡');
                //     });
                // }

                this.cache.set(message.id, page + 1);

                await message.edit({
                    embeds: [this.buildListingEmbed(page + 1)]
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

                await message.edit({
                    embeds: [this.buildListingEmbed(page - 1)]
                });
                break;
        }

        this.addReactionListeners(message, controllers);
    }
}
