import { describe, expect, it, vi } from "vitest";
import {
  startWakeLock,
  type WakeLockApi,
  type WakeLockEnvironment,
  type WakeLockSentinelLike,
} from "../../src/session/wakeLock";

interface FakeEnvironment {
  env: WakeLockEnvironment;
  sentinels: WakeLockSentinelLike[];
  request: ReturnType<typeof vi.fn>;
  setHidden: (hidden: boolean) => void;
  listenerCount: () => number;
}

function createFakeEnvironment(
  options: { hidden?: boolean; requestImpl?: () => Promise<WakeLockSentinelLike> } = {},
): FakeEnvironment {
  let hidden = options.hidden ?? false;
  const listeners = new Set<() => void>();
  const sentinels: WakeLockSentinelLike[] = [];
  const request = vi.fn(
    options.requestImpl ??
      (async () => {
        const sentinel = { release: vi.fn(async () => {}) };
        sentinels.push(sentinel);
        return sentinel;
      }),
  );
  const wakeLock: WakeLockApi = { request };
  return {
    env: {
      wakeLock,
      isHidden: () => hidden,
      onVisibilityChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    sentinels,
    request,
    setHidden: (value) => {
      hidden = value;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("startWakeLock", () => {
  it("requests a screen wake lock on start", async () => {
    const fake = createFakeEnvironment();
    startWakeLock(fake.env);
    await flush();
    expect(fake.request).toHaveBeenCalledExactlyOnceWith("screen");
  });

  it("is a no-op when the API is missing", async () => {
    const handle = startWakeLock({
      wakeLock: undefined,
      isHidden: () => false,
      onVisibilityChange: () => {
        throw new Error("must not subscribe without the API");
      },
    });
    await expect(handle.stop()).resolves.toBeUndefined();
  });

  it("releases the lock on stop and stops listening", async () => {
    const fake = createFakeEnvironment();
    const handle = startWakeLock(fake.env);
    await flush();
    await handle.stop();
    expect(fake.sentinels[0].release).toHaveBeenCalledOnce();
    expect(fake.listenerCount()).toBe(0);
  });

  it("releases when the tab is hidden", async () => {
    const fake = createFakeEnvironment();
    startWakeLock(fake.env);
    await flush();
    fake.setHidden(true);
    await flush();
    expect(fake.sentinels[0].release).toHaveBeenCalledOnce();
  });

  it("re-acquires on visible while the session is active", async () => {
    const fake = createFakeEnvironment();
    startWakeLock(fake.env);
    await flush();
    fake.setHidden(true);
    await flush();
    fake.setHidden(false);
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(2);
  });

  it("does not re-acquire after the session has stopped", async () => {
    const fake = createFakeEnvironment();
    const handle = startWakeLock(fake.env);
    await flush();
    await handle.stop();
    fake.setHidden(false);
    await flush();
    expect(fake.request).toHaveBeenCalledOnce();
  });

  it("does not request while the tab is hidden, then acquires on visible", async () => {
    const fake = createFakeEnvironment({ hidden: true });
    startWakeLock(fake.env);
    await flush();
    expect(fake.request).not.toHaveBeenCalled();
    fake.setHidden(false);
    await flush();
    expect(fake.request).toHaveBeenCalledOnce();
  });

  it("does not stack requests on repeated visible events", async () => {
    const fake = createFakeEnvironment();
    startWakeLock(fake.env);
    await flush();
    fake.setHidden(false);
    fake.setHidden(false);
    await flush();
    expect(fake.request).toHaveBeenCalledOnce();
  });

  it("swallows a denied request and can retry on the next visible event", async () => {
    let attempt = 0;
    const fake = createFakeEnvironment({
      requestImpl: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error("NotAllowedError");
        }
        return { release: vi.fn(async () => {}) };
      },
    });
    startWakeLock(fake.env);
    await flush();
    fake.setHidden(false);
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(2);
  });

  it("releases a lock granted after stop was called", async () => {
    const release = vi.fn(async () => {});
    let grant: (sentinel: WakeLockSentinelLike) => void = () => {};
    const fake = createFakeEnvironment({
      requestImpl: () => new Promise((resolve) => (grant = resolve)),
    });
    const handle = startWakeLock(fake.env);
    await handle.stop();
    grant({ release });
    await flush();
    expect(release).toHaveBeenCalledOnce();
  });

  it("tolerates release() rejecting", async () => {
    const fake = createFakeEnvironment({
      requestImpl: async () => ({
        release: async () => {
          throw new Error("already released");
        },
      }),
    });
    const handle = startWakeLock(fake.env);
    await flush();
    await expect(handle.stop()).resolves.toBeUndefined();
  });
});
