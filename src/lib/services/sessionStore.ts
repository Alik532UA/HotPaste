const PREFIX = "hotpaste_";

const toKey = (key: string): string =>
  key.startsWith(PREFIX) ? key : PREFIX + key;

function getSession(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const sessionStore = {
  get(key: string): string | null {
    const s = getSession();
    if (!s) return null;
    try {
      return s.getItem(toKey(key));
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    const s = getSession();
    if (!s) return false;
    try {
      s.setItem(toKey(key), value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    const s = getSession();
    if (!s) return;
    try {
      s.removeItem(toKey(key));
    } catch {
      // ignore
    }
  },
  clear(): number {
    const s = getSession();
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
    const raw = this.get(key);
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
      return this.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
