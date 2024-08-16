import { SlashCommandBuilder } from '@discordjs/builders';
import got from 'got';
import * as t from 'io-ts';

import Twinkle from '$src/Twinkle';
import Command from '../structs/Command';
import { assert } from 'assertmin';
import { Message } from 'discord.js';

const UsersApiSchema = t.type({
    query: t.type({
        users: t.array(
            t.type({
                userid: t.number,
                name: t.string
            })
        )
    })
});

const UserDataApiSchema = t.type({
    userData: t.type({
        id: t.number,
        name: t.string,
        localEdits: t.number
    })
});

const UserAttributeSchema = t.type({
    name: t.string,
    value: t.string
});

export default class MemberCommand extends Command {
    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['member', 'verify'];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option =>
                option.setName('username')
                    .setDescription('Your Fandom username')
                    .setRequired(true)
            );

        this.shortdesc = `Gives you the member role.`;
        this.desc = `Gives you the member role if don't already have it, requires one edit on dev.`;
        this.usages = [
            '!member wiki-username'
        ];
    }

    async getUserId(username: string): Promise<number> {
        const response = await got('https://dev.fandom.com/api.php', {
            searchParams: {
                action: 'query',
                list: 'users',
                ususers: username,
                format: 'json'
            }
        }).json();

        assert(UsersApiSchema.is(response));

        return response.query.users[0].userid;
    }

    async getEditCount(userId: number): Promise<number> {
        const response = await got(`https://dev.fandom.com/wikia.php`, {
            searchParams: {
                controller: 'UserProfile',
                method: 'getUserData',
                userId: userId,
                format: 'json'
            }
        }).json()

        assert(UserDataApiSchema.is(response));

        return response.userData.localEdits;
    }

    async getMastheadDiscord(userId: number): Promise<string | null> {
        const response = await got(`https://services.fandom.com/user-attribute/user/${userId}/attr/discordHandle`, {
            headers: {
                accept: '*/*'
            }
        }).json();

        if (UserAttributeSchema.is(response)) {
            return response.value;
        }

        return null;
    }

    async call(message: Message, content: string) {
        if (!message.member) return;

        if (!content) {
            return message.channel.send('You need to specify a username.');
        }

        if (message.member.roles.cache.has('246302564625285121')) {
            return message.channel.send('You already have the role.');
        }

        const userId = await this.getUserId(content);

        if (!userId) {
            return message.channel.send('That user does not exist.');
        }

        const edits = await this.getEditCount(userId);

        if (edits < 1) {
            return message.channel.send('You do not have enough edits.');
        }

        const verifyUser = await this.getMastheadDiscord(userId);

        if (message.author.discriminator?.length !== 4) {
            if (verifyUser !== message.author.username) {
                return message.channel.send(`The username in the masthead does not match the username of the message author. Use <https://dev.fandom.com/wiki/Special:VerifyUser/${encodeURIComponent(content)}?user=${encodeURIComponent(message.author.username)}&c=!member&ch=lobby> to remedy this.`);
            } // else we have a matching new-style username
        } else if (verifyUser !== message.author.tag) {
            return message.channel.send(`The username and tag in the masthead do not match the username and tag of the message author. Use <https://dev.fandom.com/wiki/Special:VerifyUser/${encodeURIComponent(content)}?user=${encodeURIComponent(message.author.username)}&tag=${message.author.discriminator}&c=!member&ch=lobby> to remedy this.`);
        } // else we have a matching old-style username and discriminator

        await message.member.roles.add('246302564625285121');
        return message.channel.send('Role has been added.');
    }
}
