import { templateToStarter } from "../data/seed";
import type { SessionEvaluation } from "../domain/program";
import { loadPlanQueue, peekNextTemplate, peekUpcoming } from "../plan/queue";
import { planSession } from "../rules/planSession";
import {
  appendHistory,
  applyEvaluationToMemory,
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
  const upcoming = peekUpcoming(queue, 3);
  const next = peekNextTemplate(queue);
  const forecast = forecastStripHtml(upcoming);

  renderShell(
    root,
    "today",
    `<div data-panel>
      <main class="shell">
        <p class="eyebrow">Aurora · Rassvet</p>
        <h1>Today</h1>
        <p class="tagline">Next in queue: <strong>${next.name}</strong>${
          next.targetExerciseIds.length
            ? ` → target path locked`
            : ""
        }</p>
        ${forecast}
        <div data-checkin></div>
      </main>
    </div>`,
    (tab) => showTab(root, tab),
  );

  renderCheckIn(root.querySelector("[data-checkin]")!, {
    onStart: (readiness) => {
      void (async () => {
        await unlockCoachAudio();
        await speakCoachLine("session_start");
      })();
      const template = peekNextTemplate(loadPlanQueue());
      const planned = planSession(
        readiness,
        templateToStarter(template),
        loadMemories(),
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
