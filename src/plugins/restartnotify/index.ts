import { TextChannel } from 'discord.js';
import Twinkle from '$src/Twinkle';
import Plugin from '$src/structs/Plugin';
import { ConfigProvider } from '$src/structs/Config';
import SQLPlugin, { SQLHandle } from '../sql';

const lastRestartChannelCmd = process.argv
    .map(arg => arg.split('='))
    .find(arg => arg[0] === '--last-restart-channel');

export default class RestartNotifyPlugin extends Plugin {
    static get deps() {
        return lastRestartChannelCmd ?
            [] :
            [
                SQLPlugin
            ];
    }

    private sqlPlugin: SQLPlugin | undefined;
    private sql: SQLHandle<'getLastRestart' | 'deleteLastRestart'> | undefined;

    constructor(bot: Twinkle, config: ConfigProvider) {
        super(bot, config);

        if (!lastRestartChannelCmd) {
            this.sqlPlugin = bot.loadPlugin<SQLPlugin>(SQLPlugin);
            this.sql = this.sqlPlugin.handle('restartnotify')
                .with(
                    'getLastRestart',
                    `
                        SELECT channel_id
                        FROM last_restart
                        WHERE
                            id = 1
                    `,
                    s => s.safeIntegers().pluck()
                )
                .with(
                    'deleteLastRestart',
                    `
                        DELETE FROM last_restart
                        WHERE
                            id = 1
                    `
                );

            this.sql.exec(`CREATE TABLE IF NOT EXISTS last_restart (
                id INTEGER PRIMARY KEY,
                channel_id INTEGER NOT NULL
            )`);
        }

        bot.listen('ready', this.onReady, this);
    }

    async onReady() {
        try {
            let channelId: string;

            if (lastRestartChannelCmd) {
                channelId = lastRestartChannelCmd[1];
            } else {
                if (!this.sql) return;
                channelId = await this.sql.statement('getLastRestart').get() as string;
                if (!channelId) return;

                await this.sql.statement('deleteLastRestart').run();
            }

            const channel = await this.bot.client.channels.fetch(channelId);
            if (!(channel instanceof TextChannel)) return;

            await channel.send('Restarted!');
        } catch(e) {
            console.error('wat');
            console.error(e);
        }
    }
}
