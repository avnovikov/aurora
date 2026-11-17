import { readFileSync } from "node:fs";
import { join } from "node:path";

/** A real phone's Aurora `localStorage`, pulled by `scripts/pull-device-snapshot.mjs`. */
export interface DeviceSnapshot {
  capturedAt: string;
  device: string;
  app: { package: string; versionName?: string };
  /** `aurora.*` keys with their values already JSON-parsed. */
  localStorage: Record<string, unknown>;
}

const DIR = join(__dirname, "../fixtures/device");

export function loadDeviceSnapshot(name: string): DeviceSnapshot {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8")) as DeviceSnapshot;
}

/**
 * Snapshot as raw `localStorage` strings — pass to `useMemoryStorage` as its seed:
 * `useMemoryStorage(() => deviceStorage("2026-11-17-pixel10"))`.
 */
export function deviceStorage(name: string): Record<string, string> {
  const { localStorage } = loadDeviceSnapshot(name);
  return Object.fromEntries(
    Object.entries(localStorage).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );
}
