import { Message } from "discord.js";
import AutomodPlugin from "..";
import { ConfigProvider } from "../../../structs/Config";
import { hideProperties } from "../../../util/define";

export default class AutomodFilter {
    protected automod: AutomodPlugin;

    constructor(automod: AutomodPlugin, config: ConfigProvider) {
        this.automod = automod;

        hideProperties<any>(this, ['automod']);
    }

    interested(message: Message): boolean | Promise<boolean> {
        throw new Error('Unimplemented');
    }

    handle(message: Message) {
        throw new Error('Unimplemented');
    }
}
