const PREFIX = "hotpaste_";

const toKey = (key: string): string =>
  key.startsWith(PREFIX) ? key : PREFIX + key;

function getStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  get(key: string): string | null {
    const s = getStore();
    if (!s) return null;
    try {
      return s.getItem(toKey(key));
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    const s = getStore();
    if (!s) return false;
    try {
      s.setItem(toKey(key), value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    const s = getStore();
    if (!s) return;
    try {
      s.removeItem(toKey(key));
    } catch {
      // ignore
    }
  },
  clear(): number {
    const s = getStore();
    if (!s) return 0;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => s.removeItem(k));
      return keysToRemove.length;
    } catch {
      return 0;
    }
  },
  getJSON<T>(key: string, isValid?: (val: unknown) => val is T): T | null {
    const raw = storage.get(key);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw);
      if (isValid && !isValid(parsed)) return null;
      return parsed as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown): boolean {
    try {
      return storage.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
