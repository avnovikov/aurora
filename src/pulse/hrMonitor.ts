import { parseHeartRateMeasurement } from "./hrParse";

/** Heart Rate service UUID (0x180D). */
export const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
/** Heart Rate Measurement characteristic (0x2A37). */
export const HEART_RATE_MEASUREMENT =
  "00002a37-0000-1000-8000-00805f9b34fb";

export type BpmListener = (bpm: number) => void;
export type DisconnectListener = () => void;

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

export interface ConnectHeartRateResult {
  ok: boolean;
  message: string;
}

/** Shown on web (and when BLE client is unavailable) instead of pairing. */
export const PULSE_STRAP_NEEDS_ANDROID_APP =
  "Pulse strap needs the Aurora Android app (Capacitor). Use Pulse ok / lost to simulate on web.";
export const PULSE_STRAP_CONNECTED = "Pulse strap connected.";
export const PULSE_STRAP_ALREADY_CONNECTED = "Pulse strap already connected.";
export const PULSE_STRAP_DISCONNECTED = "Pulse strap disconnected.";

let activeDeviceId: string | null = null;
let clientOverride: BleHeartRateClient | null = null;
let connectInFlight: Promise<ConnectHeartRateResult> | null = null;
const bpmListeners = new Set<BpmListener>();
const disconnectListeners = new Set<DisconnectListener>();

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

export function isHeartRateConnected(): boolean {
  return activeDeviceId !== null;
}

/** True while connected or a connect attempt is still running. */
export function isHeartRateLinkActive(): boolean {
  return activeDeviceId !== null || connectInFlight !== null;
}

/** Drop BPM / disconnect listeners without tearing down the BLE link. */
export function unsubscribeHeartRate(
  onBpm: BpmListener,
  onDisconnect?: DisconnectListener,
): void {
  bpmListeners.delete(onBpm);
  if (onDisconnect) {
    disconnectListeners.delete(onDisconnect);
  }
}

function subscribeHeartRate(
  onBpm: BpmListener,
  onDisconnect?: DisconnectListener,
): void {
  bpmListeners.add(onBpm);
  if (onDisconnect) {
    disconnectListeners.add(onDisconnect);
  }
}

function clearListeners(): void {
  bpmListeners.clear();
  disconnectListeners.clear();
}

function notifyBpm(bpm: number): void {
  for (const listener of bpmListeners) {
    listener(bpm);
  }
}

function notifyDisconnected(): void {
  activeDeviceId = null;
  const listeners = [...disconnectListeners];
  clearListeners();
  for (const listener of listeners) {
    listener();
  }
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

async function openHeartRateLink(
  client: BleHeartRateClient,
): Promise<ConnectHeartRateResult> {
  try {
    await client.initialize({ androidNeverForLocation: true });
    const device = await client.requestDevice({
      services: [HEART_RATE_SERVICE],
      optionalServices: [HEART_RATE_SERVICE],
    });
    activeDeviceId = device.deviceId;

    await client.connect(device.deviceId, () => {
      notifyDisconnected();
    });

    await client.startNotifications(
      device.deviceId,
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (value) => {
        const bpm = parseHeartRateMeasurement(value);
        if (bpm !== null) {
          notifyBpm(bpm);
        }
      },
    );

    return { ok: true, message: PULSE_STRAP_CONNECTED };
  } catch (error) {
    await disconnectHeartRate();
    const detail = error instanceof Error ? error.message : "connection failed";
    return { ok: false, message: `Pulse strap ${detail}.` };
  }
}

async function startConnectAttempt(): Promise<ConnectHeartRateResult> {
  const client = await resolveClient();
  if (!client) {
    return { ok: false, message: PULSE_STRAP_NEEDS_ANDROID_APP };
  }
  return openHeartRateLink(client);
}

/**
 * Connect to a BLE heart-rate strap and push BPM updates.
 * Registers the given listeners even when already connected (Today → session).
 * Concurrent callers share one in-flight attempt.
 * Never throws; failures return `{ ok: false, message }`.
 */
export async function connectHeartRate(
  onBpm: BpmListener,
  onDisconnect?: DisconnectListener,
): Promise<ConnectHeartRateResult> {
  subscribeHeartRate(onBpm, onDisconnect);

  if (activeDeviceId) {
    return { ok: true, message: PULSE_STRAP_ALREADY_CONNECTED };
  }

  if (!connectInFlight) {
    connectInFlight = startConnectAttempt().finally(() => {
      connectInFlight = null;
    });
  }

  const result = await connectInFlight;
  if (!result.ok) {
    unsubscribeHeartRate(onBpm, onDisconnect);
  }
  return result;
}

export async function disconnectHeartRate(): Promise<void> {
  const deviceId = activeDeviceId;
  connectInFlight = null;
  if (!deviceId) {
    clearListeners();
    return;
  }
  const client = await resolveClient();
  activeDeviceId = null;
  clearListeners();
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
