const fs = require('fs');
const path = require('path');
const Plugin = require('../../structs/plugin.js');
const Collection = require('../../structs/collection.js');

class CommanderPlugin extends Plugin {
    load() {
        this.bot.commander = new Commander(this.bot);
    }
}

class Commander {
    constructor(bot) {
        // this.all = fs.readdirSync(path.join(path.dirname(__dirname), 'commands'))
        //     .map(name => name.slice(0, -3));
        this.commands = new Collection();
        this.bot = bot;
        this.config = bot.config.COMMANDER;
        this.prefixes = this.config.PREFIXES;
        this.whitespace = [9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279];

        // if (this.config.commands) {
        //     if (this.config.commands == true) {
        //         if (this.config.blacklist) {
        //             this.all = this.all.filter(name => !this.config.blacklist.includes(name));
        //         }

        //         this.all.forEach(this.loadCommand.bind(this));
        //     } else {
        //         this.config.commands.forEach(this.loadCommand.bind(this));
        //     }
        //     this.sortCommandsByPriority();
        // }

        bot.client.on('message', this.onMessage.bind(this));
    }


    loadCommand(Command, name) {
        let log = `Loading command ${Command.name} ${name}.js`;
        const deps = Command.deps;

        if (deps.length) {
            log += `\nDependencies:\n${deps.map(plugin => `  - ${plugin.name}`).join('\n')}`;
        }

        console.log(log);

        deps.forEach(this.bot.loadPlugin.bind(this.bot));

        const command = new Command(this.bot);
        this.commands.set(name, command);
    }

    loadCommandDir(dir) {
        fs.readdirSync(dir).forEach(file => {
            const p = path.join(dir, file);
            const Command = require(p);
            this.loadCommand(Command, file.slice(0, -3));
        });

        this.sortCommandsByPriority();
    }

    sortCommandsByPriority() {
        this.commands = this.commands.sort((a, b) => b.priority - a.priority);
        this.validateCommandAliases();
    }

    validateCommandAliases() {
        const priorityAliases = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: []
        },
        aliasMap = {
            0: {},
            1: {},
            2: {},
            3: {},
            4: {}
        };
        this.commands.each(command => {
            if (!command.aliases.length) {
                console.log('Command has no defined aliases', command);
                return;
            }
            command.aliases = command.aliases.filter(alias => {
                const conflicting = priorityAliases[command.priority].includes(alias);
                if (conflicting) {
                    console.log('Duplicate alias:', alias);
                    console.log('Conflicting commands:', aliasMap[command.priority][alias], command);
                    return false;
                }
                priorityAliases[command.priority].push(alias);
                aliasMap[command.priority][alias] = command;
                return true;
            });
        });
    }

    onMessage(message) {
        let text = message.content.trim(),
        i = this.prefixes.length;

        console.log(text);

        while (i--) {
            const prefix = this.prefixes[i];
            if (text.slice(0, prefix.length) != prefix) continue;

            let matched = false;
            for (const command of this.commands.values()) {
                const aliases = command.aliases;
                let i = aliases.length;
                while (i--) {
                    const alias = aliases[i],
                    sum = prefix.length + alias.length;
                    if (text.slice(prefix.length, sum) != alias) continue;
                    const code = text.charCodeAt(sum);
                    if (code === code && !this.whitespace.includes(code)) continue;
                    if (!command.filter(message)) continue;
                    matched = true;
                    command.call(message, text.slice(sum + 1));
                }

                if (matched) break;
            }

            if (matched) break;
        }
    }

    run(command, message, content) {
        for (const command of this.commands.values()) {
            const aliases = command.aliases;
            let i = aliases.length;
            while (i--) {

            }
        }
    }
}

module.exports = CommanderPlugin;