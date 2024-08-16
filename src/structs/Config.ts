import { readFileSync } from 'fs';
import { EventEmitter } from 'events';
import { assert } from 'assertmin';
import { JSONObject, JSONValue } from '../types/JSONValue';
import { definePrivate } from '../util/define';
import RequiredEmitter from './RequiredEmitter';
import * as t from 'io-ts';

export type ConfigSource = {
    type: 'env';
    parse?: boolean;
} | {
    type: 'json-file';
    path: string;
    drill?: string | string[];
} | {
    type: 'raw';
    value: JSONObject;
};

// Parse a dictionary of environment files, converting JSON objects and arrays
// into objects and arrays. Respectively.
function parseEnv(env: JSONObject) {
    for (const key in env) {
        const value = env[key];

        // Only try to parse strings for... obvious reasons, and
        // only arrays or objects for type safety reasons
        // Those are fairly likely to be json, as opposed to a string that may be "null"
        if (typeof value == 'string' && ['{', '['].includes(value.charAt(0))) {
            try {
                env[key] = JSON.parse(value);
            } catch(e) {}
        }
    }
}

type ConfigEvent = {
    provider: ConfigProvider;
    key: string;
}

type ConfigEvents = {
    'unknown-provider': [ConfigEvent];
    'provider-read': [ConfigEvent];
}

// Synchronous, global, trusted configuration, for startup
// Reading must be done via proxy providers, generated from this class
// For other configuration, like per-guild or user, use something else
// Like a configuration plugin
// Providers log and track the top-level keys they access
export default class Config {
    private data!: JSONObject;
    private emitter: EventEmitter;
    private knownProviders: Set<ConfigProvider>;

    constructor(sources: ConfigSource[] = []) {
        definePrivate(this, 'data', {});

        this.emitter = new RequiredEmitter<ConfigEvents>();
        this.knownProviders = new Set();

        for (const source of sources) {
            this.loadSource(source);
        }
    }

    on<K extends keyof ConfigEvents>(event: K, listener: (...args: ConfigEvents[K]) => void) {
        this.emitter.on(event, listener);
    }

    loadSource(source: ConfigSource) {
        switch (source.type) {
            case 'env': {
                // process.env can contain undefined, so it doesn't fit.
                // Cast anyways, if you find an undefined when reading config, it's on you
                const env = { ...process.env } as JSONObject;

                if (source.parse) {
                    parseEnv(env);
                }

                Object.assign(this.data, env);
                break;
            }
            case 'json-file': {
                const json = readFileSync(source.path, { encoding: 'utf-8' });
                let data = JSON.parse(json);
                if (typeof source.drill === 'string') {
                    data = data[source.drill];
                } else if (Array.isArray(source.drill)) {
                    for (const prop of source.drill) {
                        data = data[prop];
                    }
                }

                Object.assign(this.data, data);
                break;
            }
            case 'raw': {
                Object.assign(this.data, source.value);
                break;
            }
            default:
                assert.unreachable(source);
        }
    }

    makeProvider(label: string) {
        const provider = new ConfigProvider(this, label);

        this.knownProviders.add(provider);

        return provider;
    }

    sealProvider(provider: ConfigProvider) {
        return this.knownProviders.delete(provider);
    }

    readFromProvider(key: string, provider: ConfigProvider): JSONValue | undefined {
        if (!this.knownProviders.has(provider)) {
            this.emitter.emit('unknown-provider', {
                provider,
                key
            });

            return undefined;
        }

        if (!provider.accessedKeys.includes(key)) {
            provider.accessedKeys.push(key);

            this.emitter.emit('provider-read', {
                provider,
                key
            });
        }

        return this.data[key];
    }
}

export class ConfigProvider {
    private globalConfig!: Config;
    public label: string;
    public accessedKeys: string[];

    constructor(globalConfig: Config, label: string) {
        definePrivate(this, 'globalConfig', globalConfig);
        this.label = label;
        this.accessedKeys = [];
    }

    public getOption(key: string, defaulted?: JSONValue): JSONValue | undefined {
        return this.globalConfig.readFromProvider(key, this) ?? defaulted;
    }

    public getOptionTyped<T extends t.Any>(key: string, schema: T, defaulted?: t.TypeOf<T>): t.TypeOf<T> {
        const value = this.getOption(key, defaulted);
        assert(schema.is(value));

        return value;
    }
}
