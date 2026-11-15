/**
 * Screen Wake Lock for an active training session.
 *
 * Lifecycle: `startWakeLock` on session start, `stop()` on session end.
 * The browser drops the lock when the tab is hidden, so we release on hide
 * and re-acquire on visible while the session is still active.
 * Without the API (or when the browser denies it) everything is a no-op.
 */

export interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export interface WakeLockApi {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

export interface WakeLockEnvironment {
  /** `navigator.wakeLock`, or undefined where unsupported. */
  wakeLock: WakeLockApi | undefined;
  isHidden: () => boolean;
  /** Subscribe to visibility changes; returns an unsubscribe function. */
  onVisibilityChange: (listener: () => void) => () => void;
}

export interface WakeLockHandle {
  stop: () => Promise<void>;
}

const NOOP_HANDLE: WakeLockHandle = { stop: async () => {} };

export function browserWakeLockEnvironment(): WakeLockEnvironment {
  const nav = navigator as Navigator & { wakeLock?: WakeLockApi };
  return {
    wakeLock: nav.wakeLock,
    isHidden: () => document.visibilityState === "hidden",
    onVisibilityChange: (listener) => {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}

export function startWakeLock(
  env: WakeLockEnvironment = browserWakeLockEnvironment(),
): WakeLockHandle {
  const api = env.wakeLock;
  if (!api) {
    return NOOP_HANDLE;
  }

  let sessionActive = true;
  let sentinel: WakeLockSentinelLike | null = null;
  let requestInFlight = false;

  const releaseSentinel = async (): Promise<void> => {
    const held = sentinel;
    sentinel = null;
    if (!held) {
      return;
    }
    try {
      await held.release();
    } catch {
      // Already released by the browser (e.g. tab hidden); nothing to do.
    }
  };

  const acquire = async (): Promise<void> => {
    if (!sessionActive || env.isHidden() || sentinel || requestInFlight) {
      return;
    }
    requestInFlight = true;
    try {
      const granted = await api.request("screen");
      sentinel = granted;
      if (!sessionActive || env.isHidden()) {
        // Session ended or tab hid while the request was pending.
        await releaseSentinel();
      }
    } catch {
      // Denied (no HTTPS, battery saver, hidden tab): keep the session running.
    } finally {
      requestInFlight = false;
    }
  };

  const handleVisibilityChange = (): void => {
    if (env.isHidden()) {
      void releaseSentinel();
      return;
    }
    void acquire();
  };

  const unsubscribe = env.onVisibilityChange(handleVisibilityChange);
  void acquire();

  return {
    stop: async () => {
      sessionActive = false;
      unsubscribe();
      await releaseSentinel();
    },
  };
}
