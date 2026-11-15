import { templateToStarter } from "../data/seed";
import type { SessionEvaluation } from "../domain/program";
import {
  loadPlanQueue,
  peekNextTemplate,
  peekUpcomingWithOverride,
} from "../plan/queue";
import { loadScheduleOverride } from "../plan/scheduleOverride";
import { planSession, type PlannedSession } from "../rules/planSession";
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
import { deloadNoteHtml } from "./deloadNote";
import { renderEvaluationView } from "./evaluationView";
import { forecastStripHtml } from "./forecastStrip";
import {
  templateDurationLabel,
  templateTargetsLabel,
  templateWarmupLabel,
} from "./formatTemplate";
import { renderLibraryView } from "./libraryView";
import { overrideControlsHtml, wireOverrideControls } from "./overrideControls";
import { advancePlanAfterSession, renderPlanView } from "./planView";
import { renderProgressView } from "./progressView";
import { renderSessionView } from "./sessionView";
import { renderSettingsView } from "./settingsView";
import { renderSetupView } from "./setupView";
import { renderShell, type AppTab } from "./shell";

const PANEL_RENDERERS: Partial<
  Record<Exclude<AppTab, "today" | "progress">, (panel: HTMLElement) => void>
> = {
  library: renderLibraryView,
  body: renderBodyView,
  plan: renderPlanView,
  settings: renderSettingsView,
};

export function bootApp(root: HTMLElement): void {
  const profile = loadProfile();
  const resume = loadSession();
  if (resume) {
    renderSessionView(root, {
      planned: resume.planned,
      resume,
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
  const upcoming = peekUpcomingWithOverride(queue, 3, override);
  const next = peekNextTemplate(queue, override);
  const forecast = forecastStripHtml(upcoming);
  const duration = templateDurationLabel(next);
  const targets = templateTargetsLabel(next.targetExerciseIds, ", ");
  const todayLabel = override ? "Today instead" : "Next in queue";

  renderShell(
    root,
    "today",
    `<div data-panel>
      <main class="shell">
        <p class="eyebrow">Aurora · Rassvet</p>
        <h1>Today</h1>
        <p class="tagline">${todayLabel}: <strong>${next.name}</strong> · ${duration}${
          targets ? ` → ${targets}` : ""
        }</p>
        <p class="hint" data-warmup-preview>${templateWarmupLabel(next)}</p>
        ${deloadNoteHtml(loadDeloadActive())}
        ${forecast}
        <div data-checkin></div>
        ${overrideControlsHtml(override)}
      </main>
    </div>`,
    (tab) => showTab(root, tab),
  );

  wireOverrideControls(root, () => showTodayHome(root));
  renderCheckIn(root.querySelector("[data-checkin]")!, {
    onStart: (readiness) => {
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
        },
      );
      renderSessionView(root, {
        planned,
        onDone: (setCount) => showEvaluation(root, setCount, planned),
      });
    },
  });
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
