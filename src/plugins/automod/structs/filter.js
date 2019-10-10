class Filter {
    constructor(bot) {
        this.offenses = new Map();
    }

    interested(message) {
        throw new Error('Unimplemented');
    }

    handle(message) {
        throw new Error('Unimplemented');
    }
}

module.exports = Filter;