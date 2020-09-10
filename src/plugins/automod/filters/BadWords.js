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
        const muteAction = message.member..roles.add('401231955741507604');
        message.author.send(`Hey! Watch your language! You've been grounded from ${message.guild.name}; message someone with the **@Server Moderator** role to talk this out.`); // TODO # of offenses
        message.author.send(`Here's a copy of your message:\`\`\`${message.content}\`\`\``);
        message.delete();

        const patternsDesc = describeMatchedPatterns('\nThe following patterns were matched:\n', this.patterns, message.content);
        const postCcnormPatternsDesc = describeMatchedPatterns('\nThe following post-ccnorm patterns were matched:\n', this.postCcnormPatterns, remove(message.content));

        const muteResult = await muteAction.then(() => 'and muted', () => 'but could not be muted');
        (await this.automod.logchan() || message.channel).send({
            embed: {
                author: {
                    name: `${message.author.username}#${message.author.discriminator} has been warned ${muteResult}`,
                    icon_url: message.author.displayAvatarURL
                },
                color: message.guild.me.displayColor,
                description: `**Reason**: Bad words matched${patternsDesc}${postCcnormPatternsDesc}\n<@${message.author.id}>`, // TODO: # of offenses
            }
        });
    }
}

module.exports = BadWordsFilter;
