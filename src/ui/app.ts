import type { BodyViewMode } from "../body/aggregate";
import { templateToStarter } from "../data/seed";
import type { HistoryPulse, SessionEvaluation } from "../domain/program";
import { readScrollY, restoreScrollY } from "../library/detailScroll";
import {
  loadPlanQueue,
  peekNextTemplate,
  peekUpcomingWithOverride,
} from "../plan/queue";
import { dayTitle } from "../plan/dayKinds";
import { loadExcluded } from "../plan/exclusions";
import { loadScheduleOverride } from "../plan/scheduleOverride";
import { planSession, type PlannedSession } from "../rules/planSession";
import { warmupLevelForTargets } from "../rules/warmupLevel";
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
import { createNavigation, type NavEntry, type Navigation } from "./navigation";
import { overrideControlsHtml, wireOverrideControls } from "./overrideControls";
import { advancePlanAfterSession, renderPlanView } from "./planView";
import { renderProgressView } from "./progressView";
import { renderHistoryView } from "./historyView";
import type { HistoryFilter } from "../progress/historyFeed";
import {
  clearPendingLightenGate,
  reinforceFromSessionEvaluation,
} from "../pulse/lightenLearning";
import { commitSessionEvaluation } from "./sessionEvaluation";
import { renderSessionView } from "./sessionView";
import { renderOnboarding } from "./onboarding";
import { renderSettingsView } from "./settingsView";
import { renderShell, type AppTab } from "./shell";
import { resetTabScroll } from "./tabScroll";
import { todayHomeHtml } from "./todayHome";
import { wireTodayPulse } from "./todayPulse";

const PANEL_RENDERERS: Partial<
  Record<
    Exclude<AppTab, "today" | "progress" | "history" | "library">,
    (panel: HTMLElement, root: HTMLElement) => void
  >
> = {
  body: showBody,
  plan: renderPlanView,
  settings: (panel) => renderSettingsView(panel),
};

let disposeTodayPulse: (() => void) | null = null;
let historyFilter: HistoryFilter = { kind: "all" };
/** Body window to reopen on Back from an exercise; reset by a tab tap. */
let bodyMode: BodyViewMode = "overall";
/** Set when History opens an exercise; consumed on the next Library paint. */
let libraryFocusId: string | null = null;
/** Drill-down Back history (#219); replaced on each boot. */
let nav: Navigation = createNavigation();
let detachNav: (() => void) | null = null;

function startNavigation(): void {
  detachNav?.();
  nav = createNavigation(window.history);
  detachNav = nav.listen(window);
}

function clearTodayPulse(): void {
  disposeTodayPulse?.();
  disposeTodayPulse = null;
}

export function bootApp(root: HTMLElement): void {
  startNavigation();
  const profile = loadProfile();
  const resume = loadSession();
  if (resume) {
    renderSessionView(root, {
      planned: resume.planned,
      resume,
      addWeightKg: profile.addWeightKg,
      onDone: (log, planned, startedAtMs, pulse) => {
        showEvaluation(root, log, planned, startedAtMs, pulse);
      },
    });
    return;
  }
  if (!profile.setupDone) {
    renderOnboarding(root, (tab) => showTab(root, tab));
    return;
  }
  showTab(root, "today");
}

function showTab(
  root: HTMLElement,
  tab: AppTab,
  options: { preserveHistoryFilter?: boolean } = {},
): void {
  resetTabScroll();
  if (tab === "today") {
    showTodayHome(root);
    return;
  }
  clearTodayPulse();
  if (tab === "history" && !options.preserveHistoryFilter) {
    historyFilter = { kind: "all" };
  }
  renderShell(root, tab, `<div data-panel></div>`, (next) => tapTab(root, next));
  const panel = requirePanel(root);
  if (tab === "progress") {
    renderProgressView(panel, {
      onJumpTab: (next) => tapTab(root, next),
      onOpenHistory: (filter) => {
        nav.push(backEntry("Progress", () => showTab(root, "progress")));
        openHistory(root, filter);
      },
    });
    return;
  }
  if (tab === "history") {
    renderHistoryView(panel, {
      filter: historyFilter,
      onClearFilter: () => openHistory(root, { kind: "all" }),
      onOpenExercise: (exerciseId) => {
        const filter = historyFilter;
        nav.push(backEntry("History", () => openHistory(root, filter)));
        openLibraryExercise(root, exerciseId);
      },
    });
    return;
  }
  if (tab === "library") {
    const initialExerciseId = libraryFocusId ?? undefined;
    libraryFocusId = null;
    renderLibraryView(panel, { initialExerciseId, nav });
    return;
  }
  const renderPanel = PANEL_RENDERERS[tab];
  if (!renderPanel) {
    throw new Error(`No panel renderer for tab: ${tab}`);
  }
  renderPanel(panel, root);
}

function showBody(panel: HTMLElement, root: HTMLElement): void {
  renderBodyView(panel, {
    mode: bodyMode,
    onOpenExercise: (exerciseId, mode) => {
      nav.push(
        backEntry("Body", () => {
          bodyMode = mode;
          showTab(root, "body");
        }),
      );
      openLibraryExercise(root, exerciseId);
    },
  });
}

/** Bottom-bar tab (or a jump to one): a fresh start, no drill-down history. */
function tapTab(root: HTMLElement, tab: AppTab): void {
  nav.clear();
  bodyMode = "overall";
  showTab(root, tab);
}

/** Back entry that runs `apply` to re-show a screen, then puts its scroll back. */
function backEntry(label: string, apply: () => void): NavEntry {
  const scrollY = readScrollY();
  return {
    label,
    restore: () => {
      apply();
      restoreScrollY(scrollY);
    },
  };
}

function openLibraryExercise(root: HTMLElement, exerciseId: string): void {
  libraryFocusId = exerciseId;
  showTab(root, "library");
}

function openHistory(root: HTMLElement, filter: HistoryFilter): void {
  historyFilter = filter;
  showTab(root, "history", { preserveHistoryFilter: true });
}

function requirePanel(root: HTMLElement): HTMLElement {
  const panel = root.querySelector<HTMLElement>("[data-panel]");
  if (!panel) {
    throw new Error("Expected [data-panel] after shell render");
  }
  return panel;
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
        ? warmupLevelForTargets(next.targetExerciseIds, loadMemories())
        : undefined,
    })}</div>`,
    (tab) => tapTab(root, tab),
  );

  clearTodayPulse();
  if (!next) {
    root.querySelector("[data-open-plan]")?.addEventListener("click", () => tapTab(root, "plan"));
    return;
  }

  wireOverrideControls(root, () => showTodayHome(root));
  disposeTodayPulse = wireTodayPulse(root);
  renderCheckIn(root.querySelector("[data-checkin]")!, {
    onStart: (readiness) => {
      clearTodayPulse();
      clearPendingLightenGate();
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
        onDone: (log, livePlanned, startedAtMs, pulse) => {
          showEvaluation(root, log, livePlanned, startedAtMs, pulse);
        },
      });
    },
  }, `Start ${dayTitle(next)}`);
}

function showEvaluation(
  root: HTMLElement,
  log: WorkoutLog,
  planned: PlannedSession,
  startedAtMs: number,
  pulse?: HistoryPulse,
): void {
  renderEvaluationView(root, log.entries.length, (evaluation: SessionEvaluation) => {
    const result = commitSessionEvaluation({
      evaluation,
      planned,
      log,
      memories: loadMemories(),
      pulse,
    });
    appendHistory(result.history);
    saveMemories(result.memories);
    reinforceFromSessionEvaluation(evaluation, startedAtMs);
    advancePlanAfterSession();
    tapTab(root, "today");
  });
}
