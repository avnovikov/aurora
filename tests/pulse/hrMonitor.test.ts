import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectHeartRate,
  disconnectHeartRate,
  HEART_RATE_MEASUREMENT,
  HEART_RATE_SERVICE,
  setBleHeartRateClientForTests,
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

describe("connectHeartRate", () => {
  it("explains when native BLE is unavailable", async () => {
    setBleHeartRateClientForTests(null);
    const status = vi.fn();
    const result = await connectHeartRate(vi.fn(), status);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Android app/i);
    expect(status).toHaveBeenCalled();
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
});
