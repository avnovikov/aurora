/**
 * Tiny string store with localStorage + in-memory fallback for unit tests.
 */
export interface KeyValueStore {
  read: () => string | null;
  write: (value: string) => void;
  clear: () => void;
}

export function createKeyValueStore(key: string): KeyValueStore {
  let memory: string | null = null;

  return {
    read(): string | null {
      if (typeof localStorage === "undefined") {
        return memory;
      }
      return localStorage.getItem(key);
    },
    write(value: string): void {
      if (typeof localStorage === "undefined") {
        memory = value;
        return;
      }
      localStorage.setItem(key, value);
    },
    clear(): void {
      memory = null;
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    },
  };
}
