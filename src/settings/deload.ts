import { createKeyValueStore } from "../storage/keyValueStore";

const store = createKeyValueStore("aurora.poc.deload.v1");

interface DeloadState {
  deloadActive: boolean;
}

function parseDeloadState(raw: string): DeloadState {
  const parsed: unknown = JSON.parse(raw);
  const active = (parsed as Partial<DeloadState> | null)?.deloadActive;
  if (typeof active !== "boolean") {
    throw new Error(`deloadActive must be a boolean; got ${String(active)}`);
  }
  return { deloadActive: active };
}

/** Manual deload flag for the POC; corrupt or missing data means "off". */
export function loadDeloadActive(): boolean {
  const raw = store.read();
  if (!raw) {
    return false;
  }
  try {
    return parseDeloadState(raw).deloadActive;
  } catch {
    return false;
  }
}

export function saveDeloadActive(deloadActive: boolean): void {
  if (typeof deloadActive !== "boolean") {
    throw new Error(`deloadActive must be a boolean; got ${String(deloadActive)}`);
  }
  store.write(JSON.stringify({ deloadActive }));
}

/** Test helper — wipe the persisted deload flag. */
export function resetDeloadForTests(): void {
  store.clear();
}
