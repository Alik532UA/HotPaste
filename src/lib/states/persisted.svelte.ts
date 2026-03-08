/**
 * Persisted State Rune — Automatically syncs state with localStorage.
 * 
 * Version 2: Explicit setter sync to avoid $effect_orphan errors
 * when used in global singleton classes during module initialization.
 */

export function persistedState<T>(key: string, defaultValue: T) {
    let value = $state<T>(load());

    function load(): T {
        if (typeof localStorage === 'undefined') return defaultValue;
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) return defaultValue;
            return JSON.parse(stored);
        } catch (err) {
            console.error(`[PersistedState] Failed to load key "${key}":`, err);
            return defaultValue;
        }
    }

    function save(v: T) {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(key, JSON.stringify(v));
        } catch (err) {
            console.error(`[PersistedState] Failed to save key "${key}":`, err);
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
