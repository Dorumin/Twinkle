const { spawn } = require('child_process');
const got = require('got');
const OPCommand = require('../structs/OPCommand.js/index.js.js');
const DatabasePlugin = require('../../db');

class RestartCommand extends OPCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['restart', 'r'];
        this.hidden = true;
        this.heroku = this.bot._globalConfig.HEROKU == 'true';

        this.shortdesc = 'Restarts the bot.';
        this.desc = 'Restarts the bot.\nThe bot will send another message once the restart has finished.\nYou need to be a bot operator to use this command.';
        this.usages = [
            '!restart'
        ];
    }

    static get deps() {
        return [
            DatabasePlugin
        ];
    }

    async call(message) {
        await Promise.all([
            message.channel.send('Restarting...'),
            // TODO: Make db writes return usable promises
            this.bot.db.set('lastRestartChannel', message.channel.id)
        ]);

        if (this.heroku) {
            this.restartHeroku();
        } else {
            this.restartProc();
        }
    }

    async restartHeroku() {
        const config = this.bot._globalConfig;
        const name = config.IS_BACKUP ? config.BACKUP_APP_NAME : config.APP_NAME;
        const token = config.HEROKU_TOKEN;

        const { body } = await got(`https://api.heroku.com/teams/apps/${name}`, {
            json: true,
            headers: {
                Accept: `application/vnd.heroku+json; version=3`,
                Authorization: `Bearer ${token}`
            }
        });

        await got.delete(`https://api.heroku.com/apps/${body.id}/dynos`, {
            headers: {
                Accept: `application/vnd.heroku+json; version=3`,
                Authorization: `Bearer ${token}`
            }
        });
    }

    restartProc() {
        const subprocess = spawn(process.argv0, process.argv.slice(1), {
            detached: true,
            stdio: 'ignore'
        });
        subprocess.unref();

        process.exit(0);
    }
}

module.exports = RestartCommand;