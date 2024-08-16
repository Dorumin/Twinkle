import { spawn } from 'child_process';

import Twinkle from '$src/Twinkle';
import OPCommand from '../structs/OPCommand';
import SQLPlugin, { SQLHandle } from '../../sql';
import { ConfigProvider } from '$src/structs/Config';
import { Message } from 'discord.js';

export default class RestartCommand extends OPCommand {
    private sqlPlugin: SQLPlugin | undefined;
    private sql: SQLHandle<'setLastRestart'> | undefined;

    private systemd: boolean;

    constructor(bot: Twinkle) {
        super(bot);
        this.aliases = ['restart', 'r'];
        this.hidden = true;

        this.shortdesc = `Restarts the bot.`;
        this.desc = `
            Restarts the bot.
            The bot will send another message once the restart has finished.
            You need to be a bot operator to use this command.`;
        this.usages = [
            '!restart'
        ];

        this.systemd = Boolean(bot.config.getOption('SYSTEMD'));

        this.sqlPlugin = bot.loadPlugin<SQLPlugin>(SQLPlugin);
        this.sql = this.sqlPlugin.handle('restart command')
            .with(
                'setLastRestart',
                `
                    REPLACE INTO last_restart (id, channel_id)
                    VALUES (1, $id)
                `,
                s => s.safeIntegers()
            );

        this.sql.exec(`CREATE TABLE IF NOT EXISTS last_restart (
            id INTEGER PRIMARY KEY,
            channel_id INTEGER NOT NULL
        )`);
    }

    async call(message: Message) {
        const channelId = message.channel.id;
        await message.channel.send('Restarting...');

        if (this.systemd) {
            await this.restartSystemd(channelId);
        } else {
            this.restartProc(channelId);
        }
    }

    restartProc(channelId: string) {
        const subprocess = spawn(
            process.argv0,
            process.argv.slice(1)
                .filter(arg => !arg.startsWith('--last-restart-channel'))
                .concat([`--last-restart-channel=${channelId}`]),
            {
                detached: true,
                stdio: 'ignore'
            }
        );
        subprocess.unref();

        process.exit(0);
    }

    async restartSystemd(channelId: string) {
        if (!this.sql) return;

        await this.sql.statement('setLastRestart').run({
            id: channelId
        });

        process.exit(1);
    }
}
