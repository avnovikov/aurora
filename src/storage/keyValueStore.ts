/**
 * Tiny string store. On Android uses the Keystore-backed AuroraSecure bridge;
 * in the browser and in unit tests falls back to localStorage (or memory).
 */
import { getSecureBridgeOrAllowLocal } from "./auroraSecure";

export interface KeyValueStore {
  read: () => string | null;
  write: (value: string) => void;
  clear: () => void;
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function createKeyValueStore(key: string): KeyValueStore {
  if (!key) {
    throw new Error("storage key must be non-empty");
  }
  let memory: string | null = null;

  return {
    read(): string | null {
      const bridge = getSecureBridgeOrAllowLocal();
      if (bridge) {
        return bridge.getItem(key);
      }
      if (!hasLocalStorage()) {
        return memory;
      }
      return localStorage.getItem(key);
    },
    write(value: string): void {
      if (typeof value !== "string") {
        throw new Error("storage value must be a string");
      }
      const bridge = getSecureBridgeOrAllowLocal();
      if (bridge) {
        bridge.setItem(key, value);
        return;
      }
      if (!hasLocalStorage()) {
        memory = value;
        return;
      }
      localStorage.setItem(key, value);
    },
    clear(): void {
      memory = null;
      const bridge = getSecureBridgeOrAllowLocal();
      if (bridge) {
        bridge.removeItem(key);
        return;
      }
      if (hasLocalStorage()) {
        localStorage.removeItem(key);
      }
    },
  };
}
