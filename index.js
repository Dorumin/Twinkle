const path = require('path');
const Doruphie = require('./src/doruphie.js');
const client = new Doruphie();

client.loadPluginDir(path.join(__dirname, 'plugins'));

client.commander.loadCommandDir(path.join(__dirname, 'plugins', 'commander', 'commands'));

client.login(client.config.TOKEN);