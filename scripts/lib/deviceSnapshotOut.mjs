import { basename, resolve } from "node:path";

/** Safe fixture basename: letters, digits, dot, dash, underscore only. */
export function sanitizeFixtureName(name) {
  const base = basename(String(name)).replace(/[^a-zA-Z0-9._-]+/g, "");
  // Reject empty, dot-only ("..", "..."), and names with no alnum content.
  if (!base || !/[a-zA-Z0-9]/.test(base)) {
    throw new Error(`unsafe fixture name: ${JSON.stringify(name)}`);
  }
  return base.endsWith(".json") ? base : `${base}.json`;
}

/**
 * Always resolve under fixtureDir — argv cannot escape that directory.
 * @param {string} fixtureDir absolute path to tests/fixtures/device
 */
export function resolveFixturePath(fixtureDir, argvName, fallbackName) {
  const fileName = sanitizeFixtureName(argvName ?? fallbackName);
  const outPath = resolve(fixtureDir, fileName);
  if (!outPath.startsWith(`${resolve(fixtureDir)}/`)) {
    throw new Error(`refusing to write outside ${fixtureDir}: ${outPath}`);
  }
  return outPath;
}

export function defaultFixtureName(capturedAt, deviceModel) {
  const model = String(deviceModel).toLowerCase().replace(/[^a-z0-9]+/g, "") || "device";
  return `${String(capturedAt).slice(0, 10)}-${model}.json`;
}

/**
 * Accept only a plain object whose keys are aurora.* (what the CDP expression returns).
 * Rebuilds a new object so callers do not pass through raw remote JSON text.
 */
export function auroraLocalStorageFromCdp(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CDP localStorage result must be a plain object");
  }
  const localStorage = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!key.startsWith("aurora.")) {
      throw new Error(`unexpected localStorage key: ${key}`);
    }
    localStorage[key] = entry;
  }
  return localStorage;
}
