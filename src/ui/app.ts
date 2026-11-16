import { templateToStarter } from "../data/seed";
import type { SessionEvaluation } from "../domain/program";
import {
  loadPlanQueue,
  peekNextTemplate,
  peekUpcomingWithOverride,
} from "../plan/queue";
import { dayTitle } from "../plan/dayKinds";
import { loadExcluded } from "../plan/exclusions";
import { loadScheduleOverride } from "../plan/scheduleOverride";
import { planSession, type PlannedSession } from "../rules/planSession";
import { warmupLevelFor } from "../rules/warmupLevel";
import {
  appendHistory,
  applyEvaluationToMemory,
  loadHistory,
  loadMemories,
  saveMemories,
} from "../session/history";
import { loadSession } from "../session/storage";
import { loadDeloadActive } from "../settings/deload";
import { loadProfile } from "../settings/profile";
import { speakCoachLine, unlockCoachAudio } from "../voice/coachVoice";
import { renderBodyView } from "./bodyView";
import { renderCheckIn } from "./checkIn";
import { renderEvaluationView } from "./evaluationView";
import { renderLibraryView } from "./libraryView";
import { overrideControlsHtml, wireOverrideControls } from "./overrideControls";
import { advancePlanAfterSession, renderPlanView } from "./planView";
import { renderProgressView } from "./progressView";
import { renderSessionView } from "./sessionView";
import { renderSettingsView } from "./settingsView";
import { renderSetupView } from "./setupView";
import { renderShell, type AppTab } from "./shell";
import { todayHomeHtml } from "./todayHome";
import { wireTodayPulse } from "./todayPulse";

const PANEL_RENDERERS: Partial<
  Record<Exclude<AppTab, "today" | "progress">, (panel: HTMLElement) => void>
> = {
  library: renderLibraryView,
  body: renderBodyView,
  plan: renderPlanView,
  settings: renderSettingsView,
};

let disposeTodayPulse: (() => void) | null = null;

function clearTodayPulse(): void {
  disposeTodayPulse?.();
  disposeTodayPulse = null;
}

export function bootApp(root: HTMLElement): void {
  const profile = loadProfile();
  const resume = loadSession();
  if (resume) {
    renderSessionView(root, {
      planned: resume.planned,
      resume,
      addWeightKg: profile.addWeightKg,
      onDone: (setCount) => showEvaluation(root, setCount, resume.planned),
    });
    return;
  }
  if (!profile.setupDone) {
    renderSetupView(root, () => showTab(root, "today"));
    return;
  }
  showTab(root, "today");
}

function showTab(root: HTMLElement, tab: AppTab): void {
  if (tab === "today") {
    showTodayHome(root);
    return;
  }
  clearTodayPulse();
  renderShell(root, tab, `<div data-panel></div>`, (next) => showTab(root, next));
  const panel = root.querySelector<HTMLElement>("[data-panel]");
  if (!panel) {
    throw new Error("Expected [data-panel] after shell render");
  }
  if (tab === "progress") {
    renderProgressView(panel, { onJumpTab: (next) => showTab(root, next) });
    return;
  }
  const renderPanel = PANEL_RENDERERS[tab];
  if (!renderPanel) {
    throw new Error(`No panel renderer for tab: ${tab}`);
  }
  renderPanel(panel);
}

function showTodayHome(root: HTMLElement): void {
  const queue = loadPlanQueue();
  const override = loadScheduleOverride();
  const next = peekNextTemplate(queue, override);

  renderShell(
    root,
    "today",
    `<div data-panel>${todayHomeHtml({
      next,
      isOverride: override !== null,
      upcoming: peekUpcomingWithOverride(queue, 3, override),
      deloadActive: loadDeloadActive(),
      overrideHtml: overrideControlsHtml(override),
      warmupLevel: warmupLevelFor({ targetExerciseIds: next.targetExerciseIds, memories: loadMemories() }),
    })}</div>`,
    (tab) => showTab(root, tab),
  );

  wireOverrideControls(root, () => showTodayHome(root));
  clearTodayPulse();
  disposeTodayPulse = wireTodayPulse(root);
  renderCheckIn(root.querySelector("[data-checkin]")!, {
    onStart: (readiness) => {
      clearTodayPulse();
      void (async () => {
        await unlockCoachAudio();
        await speakCoachLine("session_start");
      })();
      const template = peekNextTemplate(
        loadPlanQueue(),
        loadScheduleOverride(),
      );
      const planned = planSession(
        readiness,
        templateToStarter(template),
        loadMemories(),
        {
          history: loadHistory(),
          focus: template.focus,
          deloadActive: loadDeloadActive(),
          jointHistory: loadProfile().jointHistory,
          equipment: loadProfile().equipment,
          excluded: loadExcluded(),
        },
      );
      renderSessionView(root, {
        planned,
        addWeightKg: loadProfile().addWeightKg,
        onDone: (setCount) => showEvaluation(root, setCount, planned),
      });
    },
  }, `Start ${dayTitle(next)}`);
}

function showEvaluation(
  root: HTMLElement,
  setCount: number,
  planned: PlannedSession,
): void {
  renderEvaluationView(root, setCount, (evaluation: SessionEvaluation) => {
    const exerciseIds = planned.work.map((item) => item.exerciseId);
    appendHistory({
      completedAt: new Date().toISOString(),
      templateId: planned.programId,
      templateName: planned.sessionLabel,
      evaluation,
      setCount,
      exerciseIds,
    });
    const memories = applyEvaluationToMemory(loadMemories(), exerciseIds, evaluation);
    saveMemories(memories);
    advancePlanAfterSession();
    showTab(root, "today");
  });
}
