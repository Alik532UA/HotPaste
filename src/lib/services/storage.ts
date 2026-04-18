const PREFIX = 'hotpaste_';

export const storage = {
    get(key: string): string | null {
        return localStorage.getItem(PREFIX + key);
    },
    set(key: string, value: string): void {
        localStorage.setItem(PREFIX + key, value);
    },
    remove(key: string): void {
        localStorage.removeItem(PREFIX + key);
    },
    clear(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(PREFIX)) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
    },
    getJSON<T>(key: string): T | null {
        const raw = storage.get(key);
        if (raw === null) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },
    setJSON(key: string, value: unknown): void {
        storage.set(key, JSON.stringify(value));
    }
};
