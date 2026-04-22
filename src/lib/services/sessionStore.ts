const PREFIX = 'hotpaste_';

export const sessionStore = {
    get(key: string): string | null {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem(PREFIX + key);
    },
    set(key: string, value: string): void {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(PREFIX + key, value);
    },
    remove(key: string): void {
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem(PREFIX + key);
    },
    clear(): void {
        if (typeof window === 'undefined') return;
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith(PREFIX)) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    },
    getJSON<T>(key: string): T | null {
        const raw = this.get(key);
        if (raw === null) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },
    setJSON(key: string, value: unknown): void {
        this.set(key, JSON.stringify(value));
    }
};
