
export default class Cache<K, V> extends Map<K, V> {
    get(key: any, generator?: () => V): V {
        if (!this.has(key) && generator) {
            const val = generator();
            this.set(key, val);
            return val;
        }

        return super.get(key) as V;
    }
}
