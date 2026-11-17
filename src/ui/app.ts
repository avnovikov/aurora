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
  loadHistory,
  loadMemories,
  saveMemories,
} from "../session/history";
import type { WorkoutLog } from "../session/setLog";
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
import { commitSessionEvaluation } from "./sessionEvaluation";
import { renderSessionView } from "./sessionView";
import { renderOnboarding } from "./onboarding";
import { renderSettingsView } from "./settingsView";
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
      onDone: (log) => showEvaluation(root, log, resume.planned),
    });
    return;
  }
  if (!profile.setupDone) {
    renderOnboarding(root, (tab) => showTab(root, tab));
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
  const empty = queue.items.length === 0 && override === null;
  const next = empty ? null : peekNextTemplate(queue, override);
  const upcoming = empty ? [] : peekUpcomingWithOverride(queue, 3, override);

  renderShell(
    root,
    "today",
    `<div data-panel>${todayHomeHtml({
      next,
      isOverride: override !== null,
      upcoming,
      deloadActive: loadDeloadActive(),
      overrideHtml: empty ? "" : overrideControlsHtml(override),
      warmupLevel: next
        ? warmupLevelFor({ targetExerciseIds: next.targetExerciseIds, memories: loadMemories() })
        : undefined,
    })}</div>`,
    (tab) => showTab(root, tab),
  );

  clearTodayPulse();
  if (!next) {
    root.querySelector("[data-open-plan]")?.addEventListener("click", () => showTab(root, "plan"));
    return;
  }

  wireOverrideControls(root, () => showTodayHome(root));
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
      const profile = loadProfile();
      const planned = planSession(
        readiness,
        templateToStarter(template),
        loadMemories(),
        {
          history: loadHistory(),
          focus: template.focus,
          deloadActive: loadDeloadActive(),
          jointHistory: profile.jointHistory,
          equipment: profile.equipment,
          excluded: loadExcluded(),
        },
      );
      renderSessionView(root, {
        planned,
        addWeightKg: profile.addWeightKg,
        onDone: (log) => showEvaluation(root, log, planned),
      });
    },
  }, `Start ${dayTitle(next)}`);
}

function showEvaluation(
  root: HTMLElement,
  log: WorkoutLog,
  planned: PlannedSession,
): void {
  renderEvaluationView(root, log.entries.length, (evaluation: SessionEvaluation) => {
    const result = commitSessionEvaluation({
      evaluation,
      planned,
      log,
      memories: loadMemories(),
    });
    appendHistory(result.history);
    saveMemories(result.memories);
    advancePlanAfterSession();
    showTab(root, "today");
  });
}
