import type { PlannedSession } from "../rules/planSession";
import type { ActiveWorkState, WorkoutLog } from "../session/setLog";
import type { PersistedSession } from "../session/storage";
import type { PulseWatchState } from "../voice/pulseAlert";

export interface SessionViewOptions {
  planned: PlannedSession;
  resume?: PersistedSession;
  onDone: (setCount: number) => void;
  /** The athlete's own weight from Settings; "Add weight" starts there. */
  addWeightKg?: number;
}

/**
 * warmup → work ↔ rest → done; from done the optional cool-down can run
 * (done → cooldown → done). `rest` also covers the gaps between stations.
 */
export type Phase = "warmup" | "work" | "rest" | "cooldown" | "done";

export interface ViewState {
  phase: Phase;
  warmupIndex: number;
  workIndex: number;
  cooldownIndex: number;
  setIndex: number;
  log: WorkoutLog;
  workState: ActiveWorkState | null;
  restLeft: number;
  pulse: PulseWatchState;
  bpm: number | null;
  pulseStatus: string | null;
  /** Epoch ms when this session started (survives resume). */
  startedAtMs: number;
  /** Planned total seconds used for the remaining countdown. */
  plannedTotalSeconds: number;
  /** What "Add weight" puts on (Settings → Gear); the library default when unset. */
  addWeightKg?: number;
}
