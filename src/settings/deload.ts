const KEY = "aurora.poc.deload.v1";

/** In-memory fallback when `localStorage` is unavailable (unit tests). */
const memoryState: { value: string | null } = { value: null };

interface DeloadState {
  deloadActive: boolean;
}

function readStorage(): string | null {
  if (typeof localStorage === "undefined") {
    return memoryState.value;
  }
  return localStorage.getItem(KEY);
}

function writeStorage(value: string): void {
  if (typeof localStorage === "undefined") {
    memoryState.value = value;
    return;
  }
  localStorage.setItem(KEY, value);
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
  const raw = readStorage();
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
  writeStorage(JSON.stringify({ deloadActive }));
}

/** Test helper — wipe the persisted deload flag. */
export function resetDeloadForTests(): void {
  memoryState.value = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY);
  }
}
