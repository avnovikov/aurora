import { Capacitor } from "@capacitor/core";

/**
 * Synchronous native bridge installed by MainActivity as window.AuroraSecure.
 */
export interface AuroraSecureBridge {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

declare global {
  interface Window {
    AuroraSecure?: AuroraSecureBridge;
  }
}

const MISSING_BRIDGE_ON_NATIVE =
  "AuroraSecure bridge is missing on a native shell; refusing plaintext storage";

export function getAuroraSecure(): AuroraSecureBridge | undefined {
  return (globalThis as { AuroraSecure?: AuroraSecureBridge }).AuroraSecure;
}

/** True when Capacitor reports a native shell (Android/iOS). */
export function isNativeShell(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the Keystore bridge, or undefined when plaintext localStorage is allowed.
 * Throws on native shells where the bridge must exist (never fall back to plaintext).
 */
export function getSecureBridgeOrAllowLocal(): AuroraSecureBridge | undefined {
  const bridge = getAuroraSecure();
  if (bridge) {
    return bridge;
  }
  if (isNativeShell()) {
    throw new Error(MISSING_BRIDGE_ON_NATIVE);
  }
  return undefined;
}
