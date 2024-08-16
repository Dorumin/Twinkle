import { remove } from 'confusables';
import * as t from 'io-ts';

import { ConfigProvider } from '$src/structs/Config';
import AutomodPlugin from '..';
import Filter from '../structs/AutomodFilter';
import { Message } from 'discord.js';

function compilePattern(pattern: string | [string, string]) {
    return new RegExp(...(typeof(pattern) === 'string' ? [pattern, 'i'] as [string, string] : pattern));
}

function describeMatchedPatterns(preamble: string, patterns: RegExp[], content: string) {
    let patternsDesc = patterns.filter(re => re.test(content)).map(re => `\t\u2022 \`${re}\``).join('\n');
    if (patternsDesc) patternsDesc = preamble + patternsDesc;
    return patternsDesc;
}

const BadWordsConfigSchema = t.type({
    BAD_WORDS: t.type({
        PATTERNS: t.array(t.string),
        POST_CCNORM_PATTERNS: t.array(t.string)
    })
});

export default class BadWordsFilter extends Filter {
    patterns: RegExp[];
    postCcnormPatterns: RegExp[];

    constructor(automod: AutomodPlugin, config: ConfigProvider) {
        super(automod, config);

        const cfg = config.getOptionTyped('AUTOMOD', BadWordsConfigSchema).BAD_WORDS;

        this.patterns = cfg.PATTERNS.map(compilePattern);
        this.postCcnormPatterns = cfg.POST_CCNORM_PATTERNS.map(compilePattern);
    }

    interested(message: Message) {
        if (!message.member) return false;
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        if (this.patterns.some(re => re.test(message.content))) return true;

        const ccnormContent = remove(message.content);
        return this.postCcnormPatterns.some(re => re.test(ccnormContent));
    }

    async handle(message: Message) {
        if (!message.member || !message.guild) return;

        const muteAction = message.member.roles.add('401231955741507604');
        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');
        await message.delete();

        const patternsDesc = describeMatchedPatterns('\nThe following patterns were matched:\n', this.patterns, message.content);
        const postCcnormPatternsDesc = describeMatchedPatterns('\nThe following post-ccnorm patterns were matched:\n', this.postCcnormPatterns, remove(message.content));

        let logMessage = `**Reason**: Bad words matched${patternsDesc}${postCcnormPatternsDesc}\n<@${message.author.id}>`; // TODO: # of offenses
        try {
            await message.author.send(`Hey! Watch your language! You've been grounded from ${message.guild.name}; message someone with the **@Server Moderator** role to talk this out.`); // TODO # of offenses
            await message.author.send(`Here's a copy of your message:\`\`\`${message.content.slice(0, 1900)}\`\`\``);
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 50007) {
                logMessage += '\nUser blocked DMs.';
            } else {
                await this.automod.getBot().reportError('Failed to warn user:', error);
                logMessage += '\nFailed to warn user.';
            }
        }

        await (await this.automod.logchan() || message.channel).send({
            embeds: [{
                author: {
                    name: `${message.author.tag} has been warned ${muteResult}`,
                    icon_url: message.author.displayAvatarURL()
                },
                color: message.guild.me?.displayColor,
                description: logMessage
            }]
        });
    }
}
