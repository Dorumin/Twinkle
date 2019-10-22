const path = require('path');
const Twinkle = require('./src/Twinkle.js');
const client = new Twinkle();

client.loadPluginDir(path.join(__dirname, 'src', 'plugins'));

client.commander.loadCommandDir(path.join(__dirname, 'src', 'plugins', 'commander', 'commands'));

client.login(client.config.TOKEN);