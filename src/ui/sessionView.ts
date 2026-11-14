import type { PlannedSession, PlannedWorkItem } from "../rules/planSession";
import {
  appendSet,
  createEmptyLog,
  editNextReps,
  prescribedForNextSet,
  type ActiveWorkState,
  type WorkoutLog,
} from "../session/setLog";
import { clearSession, saveSession, type PersistedSession } from "../session/storage";
import { cueSchedule, speakCue } from "../voice/restCue";
import {
  shouldShoutPulseLost,
  shoutPulseNotReadable,
  type PulseWatchState,
} from "../voice/pulseAlert";

export interface SessionViewOptions {
  planned: PlannedSession;
  resume?: PersistedSession;
  onDone: () => void;
}

type Phase = "warmup" | "work" | "rest" | "done";

interface ViewState {
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

export function renderSessionView(root: HTMLElement, options: SessionViewOptions): void {
  const state = initialState(options);
  let restTimer: number | null = null;
  let warmupTimer: number | null = null;
  let pulseTimer: number | null = null;
  let spokenForRest = new Set<number>();

  const paint = (): void => {
    root.innerHTML = shellHtml(options.planned, state);
    wireControls();
    persist();
  };

  const persist = (): void => {
    if (state.phase === "done") {
      return;
    }
    saveSession({
      readiness: options.planned.readiness,
      planned: options.planned,
      log: state.log,
      phase: state.phase === "rest" ? "work" : state.phase === "warmup" ? "warmup" : "work",
      warmupIndex: state.warmupIndex,
      workIndex: state.workIndex,
      setIndex: state.setIndex,
      nextRepsOverride: state.workState?.nextRepsOverride,
      savedAt: new Date().toISOString(),
    });
  };

  const clearTimers = (): void => {
    if (restTimer !== null) {
      window.clearInterval(restTimer);
      restTimer = null;
    }
    if (warmupTimer !== null) {
      window.clearInterval(warmupTimer);
      warmupTimer = null;
    }
  };

  const finishAll = (): void => {
    clearTimers();
    if (pulseTimer !== null) {
      window.clearInterval(pulseTimer);
    }
    state.phase = "done";
    clearSession();
    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Session</p>
        <h1>Done</h1>
        <p class="tagline">${state.log.entries.length} sets logged.</p>
        <button type="button" class="cta" data-home>Back to check-in</button>
      </main>
    `;
    root.querySelector("[data-home]")?.addEventListener("click", options.onDone);
  };

  const advanceWarmup = (): void => {
    state.warmupIndex += 1;
    if (state.warmupIndex >= options.planned.warmup.length) {
      state.phase = "work";
      state.workIndex = 0;
      state.setIndex = 1;
      syncWorkState();
      paint();
      return;
    }
    paint();
    runWarmupHold();
  };

  const runWarmupHold = (): void => {
    clearTimers();
    const step = options.planned.warmup[state.warmupIndex];
    if (!step) {
      advanceWarmup();
      return;
    }
    let left = step.holdSeconds;
    warmupTimer = window.setInterval(() => {
      left -= 1;
      const countdown = root.querySelector("[data-warmup-left]");
      if (countdown) {
        countdown.textContent = String(Math.max(left, 0));
      }
      if (left <= 0) {
        clearTimers();
        const gap = step.gapSecondsAfter;
        if (gap > 0) {
          state.phase = "rest";
          state.restLeft = gap;
          paint();
          startRest(() => {
            state.phase = "warmup";
            advanceWarmup();
          }, false);
        } else {
          advanceWarmup();
        }
      }
    }, 1000);
  };

  const syncWorkState = (): void => {
    const item = currentWork(options.planned, state);
    if (!item) {
      state.workState = null;
      return;
    }
    state.workState = {
      slotId: item.slotId,
      exerciseId: item.exerciseId,
      setIndex: state.setIndex,
      prescribedReps: item.dose.reps,
      addedLoadKg: item.dose.addedLoadKg,
      nextRepsOverride: state.workState?.nextRepsOverride,
    };
  };

  const startRest = (onDoneRest: () => void, withVoice: boolean): void => {
    clearTimers();
    spokenForRest = new Set();
    const schedule = withVoice ? cueSchedule(state.restLeft) : [];
    restTimer = window.setInterval(() => {
      state.restLeft -= 1;
      const label = root.querySelector("[data-rest-left]");
      if (label) {
        label.textContent = formatRestLabel(state.restLeft, schedule);
      }
      if (withVoice) {
        speakDueCues(state.restLeft, schedule, spokenForRest);
      }
      if (state.restLeft <= 0) {
        clearTimers();
        onDoneRest();
      }
    }, 1000);
  };

  const completeSet = (stopReason: "completed" | "muscular_failure" | "skipped"): void => {
    const item = currentWork(options.planned, state);
    const work = state.workState;
    if (!item || !work) {
      return;
    }
    const prescribed = prescribedForNextSet(work);
    const completed = stopReason === "skipped" ? 0 : prescribed;
    state.log = appendSet(state.log, {
      slotId: item.slotId,
      exerciseId: item.exerciseId,
      setIndex: state.setIndex,
      prescribedReps: prescribed,
      completedReps: completed,
      addedLoadKg: work.addedLoadKg,
      stopReason,
    });
    if (state.setIndex >= item.dose.sets || stopReason === "skipped") {
      finishExercise();
      return;
    }
    state.setIndex += 1;
    state.workState = {
      ...work,
      setIndex: state.setIndex,
      prescribedReps: item.dose.reps,
      nextRepsOverride: undefined,
    };
    state.phase = "rest";
    state.restLeft = item.restSeconds;
    paint();
    startRest(() => {
      state.phase = "work";
      paint();
    }, true);
  };

  const finishExercise = (): void => {
    state.workIndex += 1;
    state.setIndex = 1;
    state.workState = null;
    if (state.workIndex >= options.planned.work.length) {
      finishAll();
      return;
    }
    syncWorkState();
    state.phase = "work";
    paint();
  };

  const wireControls = (): void => {
    root.querySelector("[data-log-set]")?.addEventListener("click", () => {
      completeSet("completed");
    });
    root.querySelector("[data-fail-set]")?.addEventListener("click", () => {
      completeSet("muscular_failure");
    });
    root.querySelector("[data-skip]")?.addEventListener("click", () => {
      completeSet("skipped");
    });
    root.querySelector("[data-cues]")?.addEventListener("click", () => {
      state.showingCues = !state.showingCues;
      paint();
    });
    root.querySelector("[data-reps-minus]")?.addEventListener("click", () => {
      if (!state.workState || state.phase !== "rest") {
        return;
      }
      state.workState = editNextReps(
        state.workState,
        Math.max(1, prescribedForNextSet(state.workState) - 1),
      );
      paint();
    });
    root.querySelector("[data-reps-plus]")?.addEventListener("click", () => {
      if (!state.workState || state.phase !== "rest") {
        return;
      }
      state.workState = editNextReps(
        state.workState,
        prescribedForNextSet(state.workState) + 1,
      );
      paint();
    });
    root.querySelector("[data-sim-pulse-lost]")?.addEventListener("click", () => {
      state.pulse = {
        connected: true,
        lastValidAtMs: Date.now() - 6000,
        lastShoutAtMs: null,
      };
      maybePulseShout();
      paint();
    });
    root.querySelector("[data-sim-pulse-ok]")?.addEventListener("click", () => {
      state.pulse = {
        connected: true,
        lastValidAtMs: Date.now(),
        lastShoutAtMs: state.pulse.lastShoutAtMs,
      };
      state.bpm = 62;
      paint();
    });

    const stage = root.querySelector<HTMLElement>("[data-swipe-stage]");
    if (stage) {
      wireSwipe(stage, () => finishExercise());
    }
  };

  const maybePulseShout = (): void => {
    const now = Date.now();
    if (shouldShoutPulseLost(state.pulse, now)) {
      shoutPulseNotReadable();
      state.pulse = { ...state.pulse, lastShoutAtMs: now };
    }
  };

  pulseTimer = window.setInterval(maybePulseShout, 2000);

  paint();
  if (state.phase === "warmup") {
    runWarmupHold();
  }
}

function initialState(options: SessionViewOptions): ViewState {
  const resume = options.resume;
  if (resume) {
    return {
      phase: resume.phase === "done" ? "done" : resume.phase,
      warmupIndex: resume.warmupIndex,
      workIndex: resume.workIndex,
      setIndex: resume.setIndex,
      log: resume.log,
      workState: null,
      restLeft: 0,
      showingCues: false,
      pulse: { connected: false, lastValidAtMs: null, lastShoutAtMs: null },
      bpm: null,
    };
  }
  return {
    phase: "warmup",
    warmupIndex: 0,
    workIndex: 0,
    setIndex: 1,
    log: createEmptyLog(),
    workState: null,
    restLeft: 0,
    showingCues: false,
    pulse: { connected: false, lastValidAtMs: null, lastShoutAtMs: null },
    bpm: null,
  };
}

function currentWork(planned: PlannedSession, state: ViewState): PlannedWorkItem | null {
  return planned.work[state.workIndex] ?? null;
}

function shellHtml(planned: PlannedSession, state: ViewState): string {
  const light = planned.lightDay ? "light-day" : "";
  const pulseClass = state.pulse.connected && state.bpm === null ? "pulse-lost" : "";
  return `
    <main class="shell session ${light}">
      ${chalkHtml(planned, state)}
      <div class="pulse-row ${pulseClass}">
        <span>Pulse ${state.bpm ?? "—"}</span>
        <button type="button" data-sim-pulse-ok>Pulse ok</button>
        <button type="button" data-sim-pulse-lost>Pulse lost</button>
      </div>
      ${bodyHtml(planned, state)}
    </main>
  `;
}

function chalkHtml(planned: PlannedSession, state: ViewState): string {
  const notches = [
    `<li class="${state.phase === "warmup" ? "active" : state.warmupIndex >= planned.warmup.length ? "done" : ""}">Warmup · 10 min</li>`,
    ...planned.work.map((item, index) => {
      const active = state.phase !== "warmup" && state.workIndex === index;
      const done = state.workIndex > index;
      return `<li class="${active ? "active" : done ? "done" : ""}">${item.label}</li>`;
    }),
  ];
  return `<ol class="chalk">${notches.join("")}</ol>`;
}

function bodyHtml(planned: PlannedSession, state: ViewState): string {
  if (state.phase === "warmup" || (state.phase === "rest" && state.workState === null && state.warmupIndex < planned.warmup.length)) {
    return warmupHtml(planned, state);
  }
  if (state.phase === "rest" && state.workState) {
    return restHtml(state);
  }
  const item = currentWork(planned, state);
  if (!item) {
    return `<p class="tagline">No work items.</p>`;
  }
  if (!state.workState) {
    state.workState = {
      slotId: item.slotId,
      exerciseId: item.exerciseId,
      setIndex: state.setIndex,
      prescribedReps: item.dose.reps,
      addedLoadKg: item.dose.addedLoadKg,
    };
  }
  return workHtml(item, state);
}

function warmupHtml(planned: PlannedSession, state: ViewState): string {
  const step = planned.warmup[state.warmupIndex];
  if (!step) {
    return `<p class="tagline">Warmup complete</p>`;
  }
  return `
    <p class="eyebrow">Warmup</p>
    <h2>${step.name}</h2>
    <p class="tagline">${step.region} · hold <span data-warmup-left>${step.holdSeconds}</span>s</p>
    <p class="reason">Continuous block · 5s same area · 10s cross area</p>
  `;
}

function workHtml(item: PlannedWorkItem, state: ViewState): string {
  const reps = state.workState ? prescribedForNextSet(state.workState) : item.dose.reps;
  const cues = state.showingCues
    ? `<ul class="cues">${item.cues.map((cue) => `<li>${cue}</li>`).join("")}</ul>`
    : "";
  const media = item.doodlePath
    ? `<img class="doodle" src="${item.doodlePath}" alt="Doodle for ${item.exerciseName}" />`
    : "";
  return `
    <div class="work-stage" data-swipe-stage>
      <p class="eyebrow">${item.label} · Set ${state.setIndex} of ${item.dose.sets}</p>
      <h2>${item.exerciseName}</h2>
      <p class="reps">${reps}</p>
      <p class="reason">${item.reason}</p>
      ${media}
      <div class="row">
        <button type="button" data-cues>Description</button>
        <button type="button" class="cta" data-log-set>Log set</button>
        <button type="button" data-fail-set>Failed</button>
        <button type="button" data-skip>Skip</button>
      </div>
      <p class="hint">Swipe right → left to finish exercise</p>
      ${cues}
    </div>
  `;
}

function restHtml(state: ViewState): string {
  const reps = state.workState ? prescribedForNextSet(state.workState) : 0;
  return `
    <p class="eyebrow">Rest</p>
    <p class="reps" data-rest-left>${state.restLeft}</p>
    <p class="tagline">Next set reps</p>
    <div class="row">
      <button type="button" data-reps-minus>−</button>
      <span class="reps-edit">${reps}</span>
      <button type="button" data-reps-plus>+</button>
    </div>
  `;
}

function formatRestLabel(
  left: number,
  schedule: ReturnType<typeof cueSchedule>,
): string {
  const due = schedule.find((event) => event.atSecondsLeft === left);
  if (due) {
    return due.text;
  }
  return String(Math.max(left, 0));
}

function speakDueCues(
  left: number,
  schedule: ReturnType<typeof cueSchedule>,
  spoken: Set<number>,
): void {
  const due = schedule.find((event) => event.atSecondsLeft === left);
  if (!due || spoken.has(left)) {
    return;
  }
  spoken.add(left);
  speakCue(due.text);
}

function wireSwipe(stage: HTMLElement, onFinish: () => void): void {
  let startX: number | null = null;
  stage.addEventListener("touchstart", (event) => {
    startX = event.changedTouches[0]?.clientX ?? null;
  });
  stage.addEventListener("touchend", (event) => {
    if (startX === null) {
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? startX;
    if (startX - endX > 80) {
      onFinish();
    }
    startX = null;
  });
  let mouseStart: number | null = null;
  stage.addEventListener("mousedown", (event) => {
    mouseStart = event.clientX;
  });
  stage.addEventListener("mouseup", (event) => {
    if (mouseStart === null) {
      return;
    }
    if (mouseStart - event.clientX > 80) {
      onFinish();
    }
    mouseStart = null;
  });
}
