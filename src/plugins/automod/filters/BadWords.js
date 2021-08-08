const { remove } = require('confusables');
const Filter = require('../structs/Filter.js');

function compilePattern(pattern) {
    return new RegExp(...(typeof(pattern) === 'string' ? [pattern, 'i'] : pattern));
}

function describeMatchedPatterns(preamble, patterns, content) {
    let patternsDesc = patterns.filter(re => re.test(content)).map(re => `\t\u2022 \`${re}\``).join('\n');
    if (patternsDesc) patternsDesc = preamble + patternsDesc;
    return patternsDesc;
}

class BadWordsFilter extends Filter {
    constructor(automod) {
        super(automod);

        this.patterns = automod.config.BAD_WORDS.PATTERNS.map(compilePattern);
        this.postCcnormPatterns = automod.config.BAD_WORDS.POST_CCNORM_PATTERNS.map(compilePattern);
    }

    interested(message) {
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;

        if (this.patterns.some(re => re.test(message.content))) return true;

        const ccnormContent = remove(message.content);
        return this.postCcnormPatterns.some(re => re.test(ccnormContent));
    }

    async handle(message) {
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
            if (error && error.code === 50007) {
                logMessage += '\nUser blocked DMs.';
            } else {
                console.error('Failed to warn user:', error);
                logMessage += '\nFailed to warn user.';
            }
        }

        await (await this.automod.logchan() || message.channel).send({
            embeds: [{
                author: {
                    name: `${message.author.tag} has been warned ${muteResult}`,
                    icon_url: message.author.displayAvatarURL()
                },
                color: message.guild.me.displayColor,
                description: logMessage
            }]
        });

    }
}

module.exports = BadWordsFilter;
