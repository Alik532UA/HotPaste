/**
 * Persisted State Rune — Automatically syncs state with localStorage.
 * 
 * Version 2: Explicit setter sync to avoid $effect_orphan errors
 * when used in global singleton classes during module initialization.
 */

import { storage } from '../services/storage';
import { logService } from '../services/logService.svelte';

export function persistedState<T>(key: string, defaultValue: T) {
    let value = $state<T>(load());

    function load(): T {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const stored = storage.get(key);
            if (stored === null) return defaultValue;
            return JSON.parse(stored);
        } catch (err) {
            logService.error('PersistedState', `Failed to load key "${key}": ${err}`);
            return defaultValue;
        }
    }

    function save(v: T) {
        if (typeof window === 'undefined') return;
        try {
            storage.set(key, JSON.stringify(v));
        } catch (err) {
            logService.error('PersistedState', `Failed to save key "${key}": ${err}`);
        }
    }

    return {
        get value() { return value; },
        set value(v: T) { 
            value = v; 
            save(v);
        }
    };
}
