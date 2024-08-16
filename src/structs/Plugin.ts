import Twinkle from '../Twinkle';
import { definePrivate } from '../util/define';
import { ConfigProvider } from './Config';

export default abstract class Plugin {
    protected bot!: Twinkle;
    protected configProvider!: ConfigProvider;

    constructor(bot: Twinkle, config: ConfigProvider) {
        definePrivate(this, 'bot', bot);
        definePrivate(this, 'configProvider', config);
    }

    async load() {}

    async cleanup() {}
}
