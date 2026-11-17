import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuroraSecureBridge } from "../../src/storage/auroraSecure";
import { createKeyValueStore } from "../../src/storage/keyValueStore";
import { migratePlaintextToSecureStorage } from "../../src/storage/migrateSecureStorage";
import { HISTORY_KEY, PROFILE_KEY } from "../../src/storage/storageKeys";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

function installBridge(map: Map<string, string>): AuroraSecureBridge {
  const bridge: AuroraSecureBridge = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  (globalThis as { AuroraSecure?: AuroraSecureBridge }).AuroraSecure = bridge;
  return bridge;
}

afterEach(() => {
  delete (globalThis as { AuroraSecure?: AuroraSecureBridge }).AuroraSecure;
  vi.restoreAllMocks();
});

describe("migratePlaintextToSecureStorage", () => {
  it("does nothing when the bridge is absent (browser / tests)", () => {
    localStorage.setItem(PROFILE_KEY, '{"bodyweightKg":80}');
    migratePlaintextToSecureStorage();
    expect(localStorage.getItem(PROFILE_KEY)).toBe('{"bodyweightKg":80}');
  });

  it("moves plaintext keys into the secure store and clears localStorage", () => {
    const secure = new Map<string, string>();
    installBridge(secure);
    localStorage.setItem(PROFILE_KEY, '{"bodyweightKg":80}');
    localStorage.setItem(HISTORY_KEY, "[]");

    migratePlaintextToSecureStorage();

    expect(secure.get(PROFILE_KEY)).toBe('{"bodyweightKg":80}');
    expect(secure.get(HISTORY_KEY)).toBe("[]");
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it("does not overwrite a key that is already in the secure store", () => {
    const secure = new Map<string, string>();
    installBridge(secure);
    secure.set(PROFILE_KEY, '{"bodyweightKg":70}');
    localStorage.setItem(PROFILE_KEY, '{"bodyweightKg":80}');

    migratePlaintextToSecureStorage();

    expect(secure.get(PROFILE_KEY)).toBe('{"bodyweightKg":70}');
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });
});

describe("createKeyValueStore with AuroraSecure", () => {
  it("reads and writes through the bridge when present", () => {
    const secure = new Map<string, string>();
    installBridge(secure);
    const store = createKeyValueStore(PROFILE_KEY);
    store.write("hello");
    expect(secure.get(PROFILE_KEY)).toBe("hello");
    expect(store.read()).toBe("hello");
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    store.clear();
    expect(secure.has(PROFILE_KEY)).toBe(false);
  });

  it("refuses plaintext writes when native but bridge is missing", async () => {
    vi.resetModules();
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true },
    }));
    const { createKeyValueStore: createStore } = await import(
      "../../src/storage/keyValueStore"
    );
    const store = createStore(PROFILE_KEY);
    expect(() => store.write("x")).toThrow(/AuroraSecure bridge is missing/);
    vi.doUnmock("@capacitor/core");
    vi.resetModules();
  });
});
