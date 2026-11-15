import { parseHeartRateMeasurement } from "./hrParse";

/** Heart Rate service UUID (0x180D). */
export const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
/** Heart Rate Measurement characteristic (0x2A37). */
export const HEART_RATE_MEASUREMENT =
  "00002a37-0000-1000-8000-00805f9b34fb";

export type BpmListener = (bpm: number) => void;
export type PulseStatusListener = (message: string) => void;

export interface BleHeartRateClient {
  initialize(options?: { androidNeverForLocation?: boolean }): Promise<void>;
  requestDevice(options: {
    services: string[];
    optionalServices?: string[];
  }): Promise<{ deviceId: string }>;
  connect(deviceId: string, onDisconnect?: (id: string) => void): Promise<void>;
  startNotifications(
    deviceId: string,
    service: string,
    characteristic: string,
    callback: (value: DataView) => void,
  ): Promise<void>;
  stopNotifications(
    deviceId: string,
    service: string,
    characteristic: string,
  ): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
}

let activeDeviceId: string | null = null;
let clientOverride: BleHeartRateClient | null = null;

export function setBleHeartRateClientForTests(
  client: BleHeartRateClient | null,
): void {
  clientOverride = client;
}

export function isNativePulseAvailable(): boolean {
  if (clientOverride) {
    return true;
  }
  const cap = (
    globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

async function resolveClient(): Promise<BleHeartRateClient | null> {
  if (clientOverride) {
    return clientOverride;
  }
  if (!isNativePulseAvailable()) {
    return null;
  }
  const mod = await import("@capacitor-community/bluetooth-le");
  return mod.BleClient as unknown as BleHeartRateClient;
}

/**
 * Connect to a BLE heart-rate strap and push BPM updates.
 * On plain web (no Capacitor), returns a clear status message and does not throw.
 */
export async function connectHeartRate(
  onBpm: BpmListener,
  onStatus?: PulseStatusListener,
): Promise<{ ok: boolean; message: string }> {
  const client = await resolveClient();
  if (!client) {
    const message =
      "Pulse strap needs the Aurora Android app (Capacitor). Use Pulse ok / lost to simulate on web.";
    onStatus?.(message);
    return { ok: false, message };
  }

  await client.initialize({ androidNeverForLocation: true });
  const device = await client.requestDevice({
    services: [HEART_RATE_SERVICE],
    optionalServices: [HEART_RATE_SERVICE],
  });
  activeDeviceId = device.deviceId;

  await client.connect(device.deviceId, () => {
    activeDeviceId = null;
    onStatus?.("Pulse strap disconnected.");
  });

  await client.startNotifications(
    device.deviceId,
    HEART_RATE_SERVICE,
    HEART_RATE_MEASUREMENT,
    (value) => {
      const bpm = parseHeartRateMeasurement(value);
      if (bpm !== null) {
        onBpm(bpm);
      }
    },
  );

  const message = "Pulse strap connected.";
  onStatus?.(message);
  return { ok: true, message };
}

export async function disconnectHeartRate(): Promise<void> {
  const deviceId = activeDeviceId;
  if (!deviceId) {
    return;
  }
  const client = await resolveClient();
  activeDeviceId = null;
  if (!client) {
    return;
  }
  try {
    await client.stopNotifications(
      deviceId,
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
    );
  } catch {
    // Already gone.
  }
  try {
    await client.disconnect(deviceId);
  } catch {
    // Already gone.
  }
}
