const Collection = require('./_Collection.js/index.js');

class Cache extends Collection {
    get(key, generator) {
        if (!this.has(key)) {
            const val = generator();
            this.set(key, val);
            return val;
        }

        return super.get(key);
    }

    getAll(generators) {
        const rets = [];

        for (const key in generators) {
            rets.push(this.get(key, generators[key]));
        }

        return rets;
    }
}

module.exports = Cache;