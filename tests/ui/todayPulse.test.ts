import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disconnectHeartRate,
  setBleHeartRateClientForTests,
  type BleHeartRateClient,
} from "../../src/pulse/hrMonitor";
import { todayPulseHtml, wireTodayPulse } from "../../src/ui/todayPulse";

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
      callback(new DataView(Uint8Array.from([0x00, 72]).buffer));
    }),
    stopNotifications: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    ...overrides,
  };
}

type FakeEl = {
  textContent: string;
  hidden: boolean;
  addEventListener: (type: string, fn: () => void) => void;
  click: () => void;
};

function fakePulseRoot(): {
  root: HTMLElement;
  status: FakeEl;
  chip: FakeEl;
  connect: FakeEl;
} {
  const listeners: Array<() => void> = [];
  const status: FakeEl = {
    textContent: "",
    hidden: false,
    addEventListener: vi.fn(),
    click: vi.fn(),
  };
  const chip: FakeEl = {
    textContent: "Pulse —",
    hidden: false,
    addEventListener: vi.fn(),
    click: vi.fn(),
  };
  const connect: FakeEl = {
    textContent: "Connect",
    hidden: false,
    addEventListener: (_type, fn) => {
      listeners.push(fn);
    },
    click: () => {
      for (const fn of listeners) {
        fn();
      }
    },
  };
  const root = {
    querySelector: (selector: string) => {
      if (selector.includes("status")) {
        return status;
      }
      if (selector.includes("chip")) {
        return chip;
      }
      if (selector.includes("connect")) {
        return connect;
      }
      return null;
    },
  } as unknown as HTMLElement;
  return { root, status, chip, connect };
}

describe("todayPulseHtml", () => {
  it("mounts a pulse row with status and Connect", () => {
    const html = todayPulseHtml();
    expect(html).toContain("data-today-pulse");
    expect(html).toContain("data-today-pulse-status");
    expect(html).toContain("data-today-pulse-connect");
    expect(html).toContain("Connect");
  });
});

describe("wireTodayPulse", () => {
  it("does not auto-connect; Connect shows BPM when native BLE is available", async () => {
    setBleHeartRateClientForTests(mockClient());
    const { root, status, chip, connect } = fakePulseRoot();
    const dispose = wireTodayPulse(root);
    expect(connect.hidden).toBe(false);
    expect(status.textContent).toBe("");
    connect.click();
    await vi.waitFor(() => {
      expect(status.textContent).toMatch(/connected/i);
    });
    expect(chip.textContent).toBe("Pulse 72");
    expect(connect.hidden).toBe(true);
    dispose();
  });

  it("shows the Android message and Connect when native BLE is unavailable", () => {
    setBleHeartRateClientForTests(null);
    const { root, status, connect } = fakePulseRoot();
    wireTodayPulse(root);
    expect(status.textContent).toMatch(/Android app/i);
    expect(connect.hidden).toBe(false);
  });

  it("Connect retries after a failed attempt", async () => {
    setBleHeartRateClientForTests(
      mockClient({
        requestDevice: vi.fn(async () => {
          throw new Error("cancelled");
        }),
      }),
    );
    const { root, status, connect } = fakePulseRoot();
    wireTodayPulse(root);
    connect.click();
    await vi.waitFor(() => {
      expect(status.textContent).toMatch(/cancelled/i);
    });
    expect(connect.hidden).toBe(false);

    setBleHeartRateClientForTests(mockClient());
    connect.click();
    await vi.waitFor(() => {
      expect(status.textContent).toMatch(/connected/i);
    });
  });
});
