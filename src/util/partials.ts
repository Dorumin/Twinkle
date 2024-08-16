
import { Message, Channel, Guild, MessageReaction, PartialMessage, PartialDMChannel, PartialGroupDMChannel, DMChannel, TextChannel, NewsChannel, GuildChannel, PartialMessageReaction } from 'discord.js';

type TMessage = PartialMessage | Message;
type TChannel = PartialDMChannel | TextChannel | Channel;
type TReaction = PartialMessageReaction | MessageReaction;
type TDiscordStruct = TMessage | TChannel | TReaction;

export function isMessagePartial(message: PartialMessage | Message) {
    return message?.partial
        || 'channel' in message && isChannelPartial(message?.channel);
}

export function isChannelPartial(channel: PartialDMChannel | Channel) {
    return channel?.partial;
}

export function isMessageReactionPartial(reaction: PartialMessageReaction | MessageReaction) {
    return reaction?.partial
        || isMessagePartial(reaction?.message);
}

export function isPartial(struct: TDiscordStruct) {
    if (struct?.partial) {
        return true;
    }

    if (struct instanceof Message) {
        return isMessagePartial(struct);
    }

    if (struct instanceof Channel) {
        return isChannelPartial(struct);
    }

    if (struct instanceof MessageReaction) {
        return isMessageReactionPartial(struct);
    }

    return false;
}
