import type { PlannedSession } from "../rules/planSession";
import type { ActiveWorkState, WorkoutLog } from "../session/setLog";
import type { PersistedSession } from "../session/storage";
import type { PulseWatchState } from "../voice/pulseAlert";

export interface SessionViewOptions {
  planned: PlannedSession;
  resume?: PersistedSession;
  onDone: (setCount: number) => void;
}

export type Phase = "warmup" | "work" | "rest" | "done";

export interface ViewState {
  phase: Phase;
  warmupIndex: number;
  workIndex: number;
  setIndex: number;
  log: WorkoutLog;
  workState: ActiveWorkState | null;
  restLeft: number;
  showingCues: boolean;
  pulse: PulseWatchState;
  bpm: number | null;
}