import {
  connectHeartRate,
  isNativePulseAvailable,
  PULSE_STRAP_CONNECTED,
  PULSE_STRAP_DISCONNECTED,
  PULSE_STRAP_NEEDS_ANDROID_APP,
  unsubscribeHeartRate,
  type BpmListener,
  type DisconnectListener,
} from "../pulse/hrMonitor";

const IDLE_CHIP = "Pulse —";

export function todayPulseHtml(): string {
  return `
    <div class="pulse-row today-pulse" data-today-pulse>
      <span class="pulse-chip" data-today-pulse-chip>${IDLE_CHIP}</span>
      <span class="tagline" data-today-pulse-status></span>
      <button type="button" data-today-pulse-connect>Connect</button>
    </div>
  `;
}

/**
 * Auto-connect on native, show status + Connect/retry otherwise.
 * Returns dispose that unsubscribes BPM listeners (call before Start).
 */
interface TodayPulseMount {
  statusEl: HTMLElement;
  chipEl: HTMLElement;
  connectBtn: HTMLButtonElement;
}

function requireTodayPulseMount(root: HTMLElement): TodayPulseMount {
  const statusEl = root.querySelector<HTMLElement>("[data-today-pulse-status]");
  const chipEl = root.querySelector<HTMLElement>("[data-today-pulse-chip]");
  const connectBtn = root.querySelector<HTMLButtonElement>(
    "[data-today-pulse-connect]",
  );
  if (!statusEl || !chipEl || !connectBtn) {
    throw new Error("todayPulse: expected pulse row markup");
  }
  return { statusEl, chipEl, connectBtn };
}

export function wireTodayPulse(root: HTMLElement): () => void {
  const { statusEl, chipEl, connectBtn } = requireTodayPulseMount(root);
  let connecting = false;

  const showConnect = (visible: boolean): void => {
    connectBtn.hidden = !visible;
  };

  const showIdleChip = (): void => {
    chipEl.textContent = IDLE_CHIP;
  };

  const onBpm: BpmListener = (bpm) => {
    chipEl.textContent = `Pulse ${bpm}`;
    statusEl.textContent = PULSE_STRAP_CONNECTED;
    showConnect(false);
  };

  const onDisconnect: DisconnectListener = () => {
    showIdleChip();
    statusEl.textContent = PULSE_STRAP_DISCONNECTED;
    showConnect(true);
  };

  const runConnect = (): void => {
    if (connecting) {
      return;
    }
    connecting = true;
    statusEl.textContent = "Connecting…";
    showConnect(false);
    void connectHeartRate(onBpm, onDisconnect).then((result) => {
      connecting = false;
      statusEl.textContent = result.message;
      showConnect(!result.ok);
      if (!result.ok) {
        showIdleChip();
      }
    });
  };

  connectBtn.addEventListener("click", runConnect);

  if (isNativePulseAvailable()) {
    runConnect();
  } else {
    statusEl.textContent = PULSE_STRAP_NEEDS_ANDROID_APP;
    showConnect(true);
  }

  return () => {
    unsubscribeHeartRate(onBpm, onDisconnect);
  };
}
