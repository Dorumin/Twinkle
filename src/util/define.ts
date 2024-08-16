type Key = string | number | symbol;

// Define a non-enumerable property on an object
export function definePrivate(receiver: any, key: Key, value: any) {
    Object.defineProperty(receiver, key, {
        writable: true,
        configurable: true,
        enumerable: false,
        value: value
    });
}

// Hide properties post-declaration
export function hideProperties<T>(receiver: T, keys: (keyof T)[]) {
    for (const key of keys) {
        Object.defineProperty(receiver, key, {
            writable: true,
            configurable: true,
            enumerable: false,
            value: receiver[key]
        });
    }
}
