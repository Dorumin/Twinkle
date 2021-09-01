class Filter {
    constructor(automod) {
        Object.defineProperty(this, 'automod', { value: automod });

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
