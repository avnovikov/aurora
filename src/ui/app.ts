import { SEED_GRAPH, templateToStarter } from "../data/seed";
import type { SessionEvaluation } from "../domain/program";
import {
  loadPlanQueue,
  peekNextTemplate,
  peekUpcomingWithOverride,
} from "../plan/queue";
import { loadScheduleOverride } from "../plan/scheduleOverride";
import { planSession } from "../rules/planSession";
import {
  estimateSessionDuration,
  formatDurationLabel,
} from "../rules/sessionDuration";
import {
  appendHistory,
  applyEvaluationToMemory,
  loadHistory,
  loadMemories,
  saveMemories,
} from "../session/history";
import { loadSession } from "../session/storage";
import { loadProfile } from "../settings/profile";
import { speakCoachLine, unlockCoachAudio } from "../voice/coachVoice";
import { renderBodyView } from "./bodyView";
import { renderCheckIn } from "./checkIn";
import { renderEvaluationView } from "./evaluationView";
import { forecastStripHtml } from "./forecastStrip";
import { renderLibraryView } from "./libraryView";
import { overrideControlsHtml, wireOverrideControls } from "./overrideControls";
import { advancePlanAfterSession, renderPlanView } from "./planView";
import { renderProgressView } from "./progressView";
import { renderSessionView } from "./sessionView";
import { renderSettingsView } from "./settingsView";
import { renderShell, type AppTab } from "./shell";

export function bootApp(root: HTMLElement): void {
  loadProfile();
  const resume = loadSession();
  if (resume) {
    renderSessionView(root, {
      planned: resume.planned,
      resume,
      onDone: (setCount) => showEvaluation(root, setCount, resume.planned),
    });
    return;
  }
  showTab(root, "today");
}

function showTab(root: HTMLElement, tab: AppTab): void {
  if (tab === "today") {
    showTodayHome(root);
    return;
  }
  if (tab === "library") {
    renderShell(root, tab, `<div data-panel></div>`, (next) => showTab(root, next));
    renderLibraryView(root.querySelector("[data-panel]")!);
    return;
  }
  if (tab === "progress") {
    renderShell(root, tab, `<div data-panel></div>`, (next) => showTab(root, next));
    renderProgressView(root.querySelector("[data-panel]")!);
    return;
  }
  if (tab === "body") {
    renderShell(root, tab, `<div data-panel></div>`, (next) => showTab(root, next));
    renderBodyView(root.querySelector("[data-panel]")!);
    return;
  }
  if (tab === "plan") {
    renderShell(root, tab, `<div data-panel></div>`, (next) => showTab(root, next));
    renderPlanView(root.querySelector("[data-panel]")!);
    return;
  }
  renderShell(root, tab, `<div data-panel></div>`, (next) => showTab(root, next));
  renderSettingsView(root.querySelector("[data-panel]")!);
}

function showTodayHome(root: HTMLElement): void {
  const queue = loadPlanQueue();
  const override = loadScheduleOverride();
  const upcoming = peekUpcomingWithOverride(queue, 3, override);
  const next = peekNextTemplate(queue, override);
  const forecast = forecastStripHtml(upcoming);
  const duration = formatDurationLabel(estimateSessionDuration(next));

  renderShell(
    root,
    "today",
    `<div data-panel>
      <main class="shell">
        <p class="eyebrow">Aurora · Rassvet</p>
        <h1>Today</h1>
        <p class="tagline">${override ? "Today instead" : "Next in queue"}: <strong>${next.name}</strong> · ${duration}${
          next.targetExerciseIds.length
            ? ` → ${next.targetExerciseIds
                .map((id) => SEED_GRAPH[id]?.name ?? id)
                .join(", ")}`
            : ""
        }</p>
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
        { history: loadHistory(), focus: template.focus },
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
  planned: { programId: string; sessionLabel: string; work: Array<{ exerciseId: string }> },
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
