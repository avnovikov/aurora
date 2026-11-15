import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectHeartRate,
  disconnectHeartRate,
  HEART_RATE_MEASUREMENT,
  HEART_RATE_SERVICE,
  isHeartRateConnected,
  setBleHeartRateClientForTests,
  unsubscribeHeartRate,
  type BleHeartRateClient,
} from "../../src/pulse/hrMonitor";

afterEach(async () => {
  await disconnectHeartRate();
  setBleHeartRateClientForTests(null);
});

function mockClient(overrides: Partial<BleHeartRateClient> = {}): BleHeartRateClient {
  return {
    initialize: vi.fn(async () => undefined),
    requestDevice: vi.fn(async () => ({ deviceId: "strap-1" })),
    connect: vi.fn(async () => undefined),
    startNotifications: vi.fn(async (_id, _s, _c, callback) => {
      callback(new DataView(Uint8Array.from([0x00, 71]).buffer));
    }),
    stopNotifications: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    ...overrides,
  };
}

/** Client that keeps the notify callback so tests can emit later BPM. */
function mockClientDeferredNotify(): {
  client: BleHeartRateClient;
  emit: (bpm: number) => void;
  dropLink: () => void;
} {
  let notify: ((value: DataView) => void) | null = null;
  let onDisconnect: ((id: string) => void) | undefined;
  const client = mockClient({
    startNotifications: vi.fn(async (_id, _s, _c, callback) => {
      notify = callback;
    }),
    connect: vi.fn(async (_id, disconnect) => {
      onDisconnect = disconnect;
    }),
  });
  return {
    client,
    emit: (bpm: number) => {
      notify?.(new DataView(Uint8Array.from([0x00, bpm]).buffer));
    },
    dropLink: () => onDisconnect?.("strap-1"),
  };
}

describe("connectHeartRate", () => {
  it("explains when native BLE is unavailable", async () => {
    setBleHeartRateClientForTests(null);
    const result = await connectHeartRate(vi.fn());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Android app/i);
  });

  it("subscribes and forwards parsed BPM from the mock client", async () => {
    const client = mockClient();
    setBleHeartRateClientForTests(client);
    const onBpm = vi.fn();
    const result = await connectHeartRate(onBpm);
    expect(result.ok).toBe(true);
    expect(client.initialize).toHaveBeenCalledWith({
      androidNeverForLocation: true,
    });
    expect(client.requestDevice).toHaveBeenCalledWith(
      expect.objectContaining({ services: [HEART_RATE_SERVICE] }),
    );
    expect(client.startNotifications).toHaveBeenCalledWith(
      "strap-1",
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      expect.any(Function),
    );
    expect(onBpm).toHaveBeenCalledWith(71);
  });

  it("returns ok without reconnecting when already connected", async () => {
    const client = mockClient();
    setBleHeartRateClientForTests(client);
    await connectHeartRate(vi.fn());
    expect(isHeartRateConnected()).toBe(true);
    const second = await connectHeartRate(vi.fn());
    expect(second.ok).toBe(true);
    expect(second.message).toMatch(/already connected/i);
    expect(client.requestDevice).toHaveBeenCalledTimes(1);
  });

  it("forwards later BPM to a second subscriber without re-pairing", async () => {
    const { client, emit } = mockClientDeferredNotify();
    setBleHeartRateClientForTests(client);
    const first = vi.fn();
    const second = vi.fn();
    await connectHeartRate(first);
    await connectHeartRate(second);
    emit(88);
    expect(first).toHaveBeenCalledWith(88);
    expect(second).toHaveBeenCalledWith(88);
    expect(client.requestDevice).toHaveBeenCalledTimes(1);
  });

  it("notifies every disconnect listener when the link drops", async () => {
    const { client, dropLink } = mockClientDeferredNotify();
    setBleHeartRateClientForTests(client);
    const firstGone = vi.fn();
    const secondGone = vi.fn();
    await connectHeartRate(vi.fn(), firstGone);
    await connectHeartRate(vi.fn(), secondGone);
    dropLink();
    expect(firstGone).toHaveBeenCalledTimes(1);
    expect(secondGone).toHaveBeenCalledTimes(1);
    expect(isHeartRateConnected()).toBe(false);
  });

  it("stops delivering BPM after unsubscribe", async () => {
    const { client, emit } = mockClientDeferredNotify();
    setBleHeartRateClientForTests(client);
    const onBpm = vi.fn();
    const onGone = vi.fn();
    await connectHeartRate(onBpm, onGone);
    unsubscribeHeartRate(onBpm, onGone);
    emit(90);
    expect(onBpm).not.toHaveBeenCalled();
  });

  it("shares one in-flight connect so a second caller does not re-pair", async () => {
    let finishRequest!: (device: { deviceId: string }) => void;
    const client = mockClient({
      requestDevice: vi.fn(
        () =>
          new Promise<{ deviceId: string }>((resolve) => {
            finishRequest = resolve;
          }),
      ),
      startNotifications: vi.fn(async () => undefined),
    });
    setBleHeartRateClientForTests(client);
    const first = connectHeartRate(vi.fn());
    await vi.waitFor(() => {
      expect(client.requestDevice).toHaveBeenCalledTimes(1);
    });
    const second = connectHeartRate(vi.fn());
    finishRequest({ deviceId: "strap-1" });
    const [a, b] = await Promise.all([first, second]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(client.requestDevice).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the picker is cancelled", async () => {
    const client = mockClient({
      requestDevice: vi.fn(async () => {
        throw new Error("cancelled");
      }),
    });
    setBleHeartRateClientForTests(client);
    const result = await connectHeartRate(vi.fn());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/cancelled/i);
  });
});
