class Transport {
    get(key) {
        throw new Error('Unimplemented');
    }

    set(key, object) {
        throw new Error('Unimplemented');
    }

    static extend(...objects) {

    }

    static _isPlainObject(object) {
        return String(object) == '[object Object]';
    }
}