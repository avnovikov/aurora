import { beforeEach } from "vitest";

/**
 * Gives every test in the enclosing file or `describe` a fresh in-memory
 * `localStorage`, optionally seeded. `seed` is called before each test so
 * its values can depend on data loaded by the test file.
 *
 * Vitest 5 / happy-dom expose `localStorage` as a getter-only accessor, so
 * plain assignment throws — replace the property instead.
 */
export function useMemoryStorage(seed: () => Record<string, string> = () => ({})): void {
  beforeEach(() => {
    const store = new Map(Object.entries(seed()));
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      } as unknown as Storage,
      configurable: true,
      writable: true,
    });
  });
}
