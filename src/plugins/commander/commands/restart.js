const { HEROKU, SYSTEMD } = require('../../../util/config.js');
const { spawn } = require('child_process');
const got = require('got');
const OPCommand = require('../structs/OPCommand.js');
const SQLPlugin = require('../../sql');

class RestartCommand extends OPCommand {
    static get deps() {
        return (HEROKU == 'true' || SYSTEMD) ? [
            SQLPlugin
        ] : [];
    }

    constructor(bot) {
        super(bot);
        this.aliases = ['restart', 'r'];
        this.hidden = true;
        this.heroku = this.bot._globalConfig.HEROKU == 'true';
        this.systemd = this.bot._globalConfig.SYSTEMD;

        this.shortdesc = `Restarts the bot.`;
        this.desc = `
            Restarts the bot.
            The bot will send another message once the restart has finished.
            You need to be a bot operator to use this command.`;
        this.usages = [
            '!restart'
        ];

        if (HEROKU == 'true' || SYSTEMD) {
            this.sql = this.bot.sql.handle('restart command');
            this.sql.exec(`CREATE TABLE IF NOT EXISTS last_restart (
                id INTEGER PRIMARY KEY,
                channel_id INTEGER NOT NULL
            )`);

            this.sql.setLastRestart = this.sql.prepare(`
                REPLACE INTO last_restart
                VALUES (1, $id)
            `).safeIntegers(true);
        }
    }

    async call(message) {
        const channelId = message.channel.id;
        await message.channel.send('Restarting...');

        if (this.heroku) {
            await this.restartHeroku(channelId);
        } else if (this.systemd) {
            await this.restartSystemd(channelId);
        } else {
            this.restartProc(channelId);
        }
    }

    async restartHeroku(channelId) {
        await this.sql.setLastRestart.run({
            id: channelId
        });
        await this.bot.sql.flush();

        const config = this.bot._globalConfig;
        const name = config.IS_BACKUP ? config.BACKUP_APP_NAME : config.APP_NAME;
        const token = config.HEROKU_TOKEN;

        const app = await got(`https://api.heroku.com/teams/apps/${name}`, {
            headers: {
                Accept: `application/vnd.heroku+json; version=3`,
                Authorization: `Bearer ${token}`
            }
        }).json();

        await got.delete(`https://api.heroku.com/apps/${app.id}/dynos`, {
            headers: {
                Accept: `application/vnd.heroku+json; version=3`,
                Authorization: `Bearer ${token}`
            }
        });
    }

    restartProc(channelId) {
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

    async restartSystemd(channelId) {
        await this.sql.setLastRestart.run({
            id: channelId
        });
        await this.bot.sql.flush();

        process.exit(1);
    }
}

module.exports = RestartCommand;
