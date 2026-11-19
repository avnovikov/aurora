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

/** True when a CDP key is an aurora.* storage key (never __proto__ / constructor). */
export function isAuroraStorageKey(key) {
  return typeof key === "string" && /^aurora\.[A-Za-z0-9._-]+$/.test(key);
}

/**
 * Accept only a plain object whose keys are aurora.* (what the CDP expression returns).
 * Clones via JSON so we never assign remote property names onto a fresh object
 * (avoids js/remote-property-injection).
 */
export function auroraLocalStorageFromCdp(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CDP localStorage result must be a plain object");
  }
  for (const key of Object.keys(value)) {
    if (!isAuroraStorageKey(key)) {
      throw new Error(`unexpected localStorage key: ${key}`);
    }
  }
  const clone = JSON.parse(JSON.stringify(value));
  if (clone === null || typeof clone !== "object" || Array.isArray(clone)) {
    throw new Error("CDP localStorage clone must be a plain object");
  }
  for (const key of Object.keys(clone)) {
    if (!isAuroraStorageKey(key)) {
      throw new Error(`unexpected localStorage key after clone: ${key}`);
    }
  }
  return clone;
}
