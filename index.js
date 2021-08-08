#!/usr/bin/env node
require('events').captureRejections = true;
const path = require('path');
const Twinkle = require('./src/Twinkle.js');
const client = new Twinkle();

client.loadPluginDir(path.join(__dirname, 'src', 'plugins'));

if (client.commander) {
    client.commander.loadCommandDir(path.join(__dirname, 'src', 'plugins', 'commander', 'commands'));
}

client.login(client.config.TOKEN);

process.on('unhandledRejection', function(reason) {
    console.error('Unhandled rejection:', reason);
});
process.on('SIGINT', client.cleanup.bind(client));
