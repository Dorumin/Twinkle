import { EventEmitter } from 'events';

// Nicking Node types because the bastards didn't expose them

type DefaultEventMap = [never];

type EventMap<T> = Record<keyof T, any[]> | DefaultEventMap;
type AnyRest = [...args: any[]];

type Key<K, T> = T extends DefaultEventMap ? string | symbol : K | keyof T;
type Args<K, T> = T extends DefaultEventMap ? AnyRest : (
    K extends keyof T ? T[K] : never
);

type EventEmitterOptions = {
    /**
     * Enables automatic capturing of promise rejection.
     */
    captureRejections?: boolean;
}

// An EventEmitter that raises an error if a subscriber didn't add any listeners to one of its events
// Could be rewritten to take its listeners on construction, but eh. Maybe later.
export default class RequiredEmitter<T extends EventMap<T> = DefaultEventMap> extends EventEmitter<T> {
    constructor(options?: EventEmitterOptions) {
        super(options);
    }

    emit<K>(eventName: Key<K, T>, ...args: Args<K, T>) {
        if (this.listenerCount(eventName) === 0) {
            throw new Error(`RequiredEmitter emitted an event "${eventName}", but there was no one listening.`);
        }

        return super.emit(eventName, ...args);
    }
}