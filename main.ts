#!/usr/bin/env node
// ^ shebangs are cringe

// Globally configure async rejections inside event emitters to raise an exception
require('events').captureRejections = true;

require('fix-esm').register();

import path from 'path';
import Twinkle from './src/Twinkle';
import CommanderPlugin from './src/plugins/commander';
import LoggerPlugin from './src/plugins/logger';
import PreloadPlugin from './src/plugins/preload';

const bot = new Twinkle();

bot.loadConfigSource({
    type: 'json-file',
    path: path.join(__dirname, 'config.json'),
    drill: 'TWINKLE'
});

bot.loadPlugin(LoggerPlugin);
bot.loadPlugin(PreloadPlugin);
bot.loadPlugin(CommanderPlugin);

// bot.loadPluginDir(path.join(__dirname, 'src', 'plugins'));

bot.getPlugin<CommanderPlugin>(CommanderPlugin)?.loadCommandDir(path.join(__dirname, 'src', 'plugins', 'commander', 'commands'));

bot.login(bot.config.getOption('TOKEN') as string);

process.on('unhandledRejection', bot.unhandledRejection.bind(bot));
process.on('SIGINT', bot.cleanup.bind(bot));
