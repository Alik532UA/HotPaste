import { storage } from "./storage";

/**
 * Debug mode state for HotPaste.
 * 3-state: true (forced on), false (forced off), null (default: dev=true, prod=false).
 */
const KEY = "debug_mode";

function readSaved(): boolean | null {
  const val = storage.get(KEY);
  return val === "1" ? true : val === "0" ? false : null;
}

class DebugMode {
  saved = $state<boolean | null>(readSaved());
  enabled = $derived(this.saved ?? import.meta.env.DEV);

  get pressesToToggle(): number {
    return import.meta.env.DEV || this.enabled ? 5 : 55;
  }

  set(value: boolean): void {
    this.saved = value;
    storage.set(KEY, value ? "1" : "0");
  }

  toggle(): boolean {
    const next = !this.enabled;
    this.set(next);
    return next;
  }
}

export const debugMode = new DebugMode();
