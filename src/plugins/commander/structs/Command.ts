import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "@discordjs/builders";
import { Message } from 'discord.js';
import { assert } from "assertmin";
import * as t from 'io-ts';

import Twinkle from "$src/Twinkle";
import { CommandCallExtraPayload } from "..";

export default abstract class Command {
    protected bot!: Twinkle;
    public aliases: string[];
    public priority: number;
    public schema!: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> | SlashCommandSubcommandsOnlyBuilder;
    public desc!: string;
    public shortdesc!: string;
    public usages!: string[];
    public examples?: string[];
    public hidden!: boolean;

    constructor(bot: Twinkle) {
        Object.defineProperty(this, 'bot', { value: bot });

        this.aliases = [];
        this.priority = 0;
    }

    validate() {
        assert(t.type({
            desc: t.string,
            shortdesc: t.string,
            aliases: t.array(t.string),
            // usages: t.array(t.string),
            // examples: t.array(t.string),
        }).is(this));
        // assert(this.schema instanceof SlashCommandBuilder);

        assert(this.aliases.length > 0);
    }

    isOperator(message: Message) {
        console.log(this.bot.operators);

        return this.bot.operators.includes(message.author.id);
    }

    isModerator(message: Message): boolean {
        return this.isOperator(message) || (
            (message.member
                && message.channel.type !== 'DM'
                && message.channel.permissionsFor(message.member.user)?.any('MANAGE_MESSAGES')) ?? false
        );
    }

    isAdmin(message: Message): boolean {
        return this.isOperator(message) || ((message.guild && message.member?.permissions.has('ADMINISTRATOR')) ?? false);
    }

    filter(message: Message): boolean {
        return true;
    }

    call(message: Message, content: string, extra: CommandCallExtraPayload) {
        throw new Error('call() not implemented');
    }

    async load() { }

    async cleanup() { }
}
