const { HEROKU } = require('../../../../config.json');
const { spawn } = require('child_process');
const fs = require('fs');
const got = require('got');
const OPCommand = require('../structs/OPCommand.js');
const DatabasePlugin = require('../../db');

class RestartCommand extends OPCommand {
    static get deps() {
        return HEROKU == 'true' ? [
            DatabasePlugin
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
        // TODO: Make db writes return usable promises
        await this.bot.db.set('lastRestartChannel', channelId);
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
        await fs.promises.writeFile('/tmp/twinkle.chan', channelId);
        process.exit(1);
    }
}

module.exports = RestartCommand;
