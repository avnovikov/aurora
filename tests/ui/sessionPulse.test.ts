import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectHeartRate,
  disconnectHeartRate,
  isHeartRateConnected,
  PULSE_STRAP_ALREADY_CONNECTED,
  setBleHeartRateClientForTests,
  type BleHeartRateClient,
} from "../../src/pulse/hrMonitor";
import { createEmptyLog } from "../../src/session/setLog";
import { INITIAL_PULSE } from "../../src/ui/pulseState";
import {
  applyConnectHeartRateResult,
  attachSessionPulse,
  isPulseLost,
} from "../../src/ui/sessionPulse";
import type { ViewState } from "../../src/ui/sessionTypes";
import { PULSE_LOST_UI_MS } from "../../src/voice/pulseAlert";

afterEach(async () => {
  await disconnectHeartRate();
  setBleHeartRateClientForTests(null);
});

function mockClientDeferred(): {
  client: BleHeartRateClient;
  emit: (bpm: number) => void;
} {
  let notify: ((value: DataView) => void) | null = null;
  const client: BleHeartRateClient = {
    initialize: vi.fn(async () => undefined),
    requestDevice: vi.fn(async () => ({ deviceId: "strap-1" })),
    connect: vi.fn(async () => undefined),
    startNotifications: vi.fn(async (_id, _s, _c, callback) => {
      notify = callback;
    }),
    stopNotifications: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
  return {
    client,
    emit: (bpm: number) => {
      notify?.(new DataView(Uint8Array.from([0x00, bpm]).buffer));
    },
  };
}

function bareState(): ViewState {
  return {
    phase: "warmup",
    warmupIndex: 0,
    workIndex: 0,
    cooldownIndex: 0,
    setIndex: 1,
    log: createEmptyLog(),
    workState: null,
    restLeft: 0,
    pulse: { ...INITIAL_PULSE },
    bpm: null,
    pulseStatus: null,
    startedAtMs: Date.now(),
    plannedTotalSeconds: 1800,
  };
}

describe("isPulseLost", () => {
  function linkedWithLastValidAt(lastValidAtMs: number): ViewState {
    const state = bareState();
    state.bpm = 72;
    state.pulse = {
      connected: true,
      lastValidAtMs,
      lastShoutAtMs: null,
    };
    return state;
  }

  it("stays quiet for brief gaps under five seconds", () => {
    const lastValidAtMs = 10_000;
    expect(
      isPulseLost(linkedWithLastValidAt(lastValidAtMs), lastValidAtMs + PULSE_LOST_UI_MS - 1),
    ).toBe(false);
  });

  it("marks lost for coral after five seconds of silence", () => {
    const lastValidAtMs = 10_000;
    expect(
      isPulseLost(linkedWithLastValidAt(lastValidAtMs), lastValidAtMs + PULSE_LOST_UI_MS),
    ).toBe(true);
  });
});

describe("applyConnectHeartRateResult", () => {
  it("clears status on success so the session bar stays quiet when linked", () => {
    const state = bareState();
    state.pulseStatus = "stale";
    const onPaint = vi.fn();
    applyConnectHeartRateResult(
      state,
      { ok: true, message: PULSE_STRAP_ALREADY_CONNECTED },
      onPaint,
    );
    expect(state.pulse.connected).toBe(true);
    expect(state.pulseStatus).toBeNull();
    expect(onPaint).toHaveBeenCalledTimes(1);
  });

  it("keeps the failure message for Connect retries", () => {
    const state = bareState();
    const onPaint = vi.fn();
    const failure = "Pulse strap cancelled.";
    applyConnectHeartRateResult(state, { ok: false, message: failure }, onPaint);
    expect(state.pulse.connected).toBe(false);
    expect(state.pulseStatus).toBe(failure);
    expect(onPaint).toHaveBeenCalledTimes(1);
  });
});

describe("attachSessionPulse", () => {
  it("does nothing when the strap is not already connected", async () => {
    const state = bareState();
    const onPaint = vi.fn();
    attachSessionPulse(state, {
      onPulseBpm: vi.fn(),
      onPulseDisconnected: vi.fn(),
      onPaint,
    });
    await Promise.resolve();
    expect(state.pulse.connected).toBe(false);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it("subscribes without re-pairing when Today already connected the strap", async () => {
    const { client, emit } = mockClientDeferred();
    setBleHeartRateClientForTests(client);
    await connectHeartRate(vi.fn());
    expect(client.requestDevice).toHaveBeenCalledTimes(1);

    const state = bareState();
    const onPulseBpm = vi.fn();
    attachSessionPulse(state, {
      onPulseBpm,
      onPulseDisconnected: vi.fn(),
      onPaint: vi.fn(),
    });
    await vi.waitFor(() => {
      expect(state.pulse.connected).toBe(true);
      expect(state.pulseStatus).toBeNull();
    });
    expect(client.requestDevice).toHaveBeenCalledTimes(1);
    emit(65);
    expect(onPulseBpm).toHaveBeenCalledWith(65);
  });

  it("attaches while a Today connect is still in flight", async () => {
    let finishRequest!: (device: { deviceId: string }) => void;
    const client: BleHeartRateClient = {
      initialize: vi.fn(async () => undefined),
      requestDevice: vi.fn(
        () =>
          new Promise<{ deviceId: string }>((resolve) => {
            finishRequest = resolve;
          }),
      ),
      connect: vi.fn(async () => undefined),
      startNotifications: vi.fn(async () => undefined),
      stopNotifications: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
    };
    setBleHeartRateClientForTests(client);
    void connectHeartRate(vi.fn());
    await vi.waitFor(() => {
      expect(client.requestDevice).toHaveBeenCalledTimes(1);
    });
    expect(isHeartRateConnected()).toBe(false);

    const state = bareState();
    attachSessionPulse(state, {
      onPulseBpm: vi.fn(),
      onPulseDisconnected: vi.fn(),
      onPaint: vi.fn(),
    });
    finishRequest({ deviceId: "strap-1" });
    await vi.waitFor(() => {
      expect(state.pulse.connected).toBe(true);
    });
    expect(client.requestDevice).toHaveBeenCalledTimes(1);
  });
});
