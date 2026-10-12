import { describe, it, expect, beforeEach, vi } from "vitest";
import { storage } from "./storage";
import { sessionStore } from "./sessionStore";

const PREFIX = "hotpaste_";

describe("StorageService (STORAGE-NAMESPACE-v10)", () => {
  let mockStorage: Record<string, string>;
  let mockSession: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    mockSession = {};

    const createMockStore = (dict: Record<string, string>) => ({
      getItem: vi.fn((key: string) => dict[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        dict[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete dict[key];
      }),
      clear: vi.fn(() => {
        for (const key in dict) {
          delete dict[key];
        }
      }),
      key: vi.fn((index: number) => Object.keys(dict)[index] || null),
      get length() {
        return Object.keys(dict).length;
      },
    });

    vi.stubGlobal("localStorage", createMockStore(mockStorage));
    vi.stubGlobal("sessionStorage", createMockStore(mockSession));
    vi.stubGlobal("window", {
      localStorage: createMockStore(mockStorage),
      sessionStorage: createMockStore(mockSession),
    });
  });

  it("should set and get a value with prefix", () => {
    storage.set("test_key", "test_value");
    expect(storage.get("test_key")).toBe("test_value");
  });

  it("should remove a value with prefix", () => {
    storage.set("test_key", "test_value");
    storage.remove("test_key");
    expect(storage.get("test_key")).toBeNull();
  });

  it("should clear only keys with prefix and preserve neighbours", () => {
    // Neighbour keys from other projects on the same origin
    window.localStorage.setItem("other_key", "other_value");
    window.localStorage.setItem("audioremote_active", "test_board");
    window.localStorage.setItem("mindstep_score", "100");

    storage.set("test_key1", "test_value1");
    storage.set("test_key2", "test_value2");

    storage.clear();

    // Neighbours survive
    expect(window.localStorage.getItem("other_key")).toBe("other_value");
    expect(window.localStorage.getItem("audioremote_active")).toBe(
      "test_board",
    );
    expect(window.localStorage.getItem("mindstep_score")).toBe("100");

    // Own keys removed
    expect(storage.get("test_key1")).toBeNull();
    expect(storage.get("test_key2")).toBeNull();
  });

  it("sessionStore should clear only keys with prefix and preserve neighbours", () => {
    window.sessionStorage.setItem("audioremote_active", "active_board");
    sessionStore.set("session_key", "session_val");

    sessionStore.clear();

    expect(window.sessionStorage.getItem("audioremote_active")).toBe(
      "active_board",
    );
    expect(sessionStore.get("session_key")).toBeNull();
  });

  it("should handle JSON correctly with validator guard", () => {
    const isProfile = (v: unknown): v is { a: number; b: string } =>
      typeof v === "object" &&
      v !== null &&
      "a" in v &&
      typeof (v as any).a === "number";

    const obj = { a: 1, b: "two" };
    storage.setJSON("test_json", obj);

    const parsed = storage.getJSON("test_json", isProfile);
    expect(parsed).toEqual(obj);

    // Invalid shape returns null
    storage.set("test_json", JSON.stringify({ a: "wrong type", b: "two" }));
    expect(storage.getJSON("test_json", isProfile)).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    storage.set("bad_json", "{ bad format");
    const parsed = storage.getJSON("bad_json");
    expect(parsed).toBeNull();
  });

  it("should not throw on QuotaExceededError or SecurityError", () => {
    window.localStorage.setItem = vi.fn(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(() => storage.set("big_key", "val")).not.toThrow();
    expect(storage.set("big_key", "val")).toBe(false);
  });
});
