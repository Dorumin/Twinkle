import * as t from 'io-ts';
import Twinkle from '../../Twinkle';
import { ConfigProvider } from '../../structs/Config';
import Plugin from '../../structs/Plugin';
import { GuildMember, User } from 'discord.js';

const BlacklistConfigSchema = t.type({
    USERS: t.array(t.string)
});

export default class BlacklistPlugin extends Plugin {
    private config: t.TypeOf<typeof BlacklistConfigSchema>;
    private userIds: string[];

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);
        this.config = config.getOptionTyped('BLACKLIST', BlacklistConfigSchema, { USERS: [] });

        this.userIds = this.config.USERS;
	}

    isBlacklisted(member: GuildMember) {
        return this.isBlacklistedUser(member.user);
    }

    isBlacklistedUser(user: User) {
        return this.userIds.includes(user.id);
    }
}
