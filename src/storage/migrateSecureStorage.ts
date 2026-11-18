import {
  getSecureBridgeOrAllowLocal,
  type AuroraSecureBridge,
} from "./auroraSecure";
import { STORAGE_KEYS } from "./storageKeys";

/**
 * Copy one plaintext localStorage entry into the secure store (if absent),
 * then always delete the plaintext key.
 */
function migrateKey(bridge: AuroraSecureBridge, key: string): void {
  const plaintext = localStorage.getItem(key);
  if (plaintext === null) {
    return;
  }
  if (bridge.getItem(key) === null) {
    bridge.setItem(key, plaintext);
  }
  localStorage.removeItem(key);
}

/**
 * One-shot: copy plaintext localStorage values into AuroraSecure, then delete
 * the plaintext. Keys already present in the secure store are not overwritten.
 */
export function migratePlaintextToSecureStorage(): void {
  // Same native/local policy as keyValueStore: refuse plaintext on native without bridge.
  const bridge = getSecureBridgeOrAllowLocal();
  if (!bridge) {
    return;
  }
  if (typeof localStorage === "undefined") {
    return;
  }
  for (const key of STORAGE_KEYS) {
    migrateKey(bridge, key);
  }
}
