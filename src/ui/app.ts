import { templateToStarter } from "../data/seed";
import type { SessionEvaluation } from "../domain/program";
import { loadPlanQueue, peekNextTemplate, peekUpcoming } from "../plan/queue";
import { planSession, type PlannedSession } from "../rules/planSession";
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
import {
  templateDurationLabel,
  templateTargetsLabel,
} from "./formatTemplate";
import { renderLibraryView } from "./libraryView";
import { advancePlanAfterSession, renderPlanView } from "./planView";
import { renderProgressView } from "./progressView";
import { renderSessionView } from "./sessionView";
import { renderSettingsView } from "./settingsView";
import { renderShell, type AppTab } from "./shell";

const PANEL_RENDERERS: Partial<
  Record<Exclude<AppTab, "today">, (panel: HTMLElement) => void>
> = {
  library: renderLibraryView,
  progress: renderProgressView,
  body: renderBodyView,
  plan: renderPlanView,
  settings: renderSettingsView,
};

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
  const renderPanel = PANEL_RENDERERS[tab];
  if (!renderPanel) {
    throw new Error(`No panel renderer for tab: ${tab}`);
  }
  renderShell(root, tab, `<div data-panel></div>`, (next) => showTab(root, next));
  const panel = root.querySelector<HTMLElement>("[data-panel]");
  if (!panel) {
    throw new Error("Expected [data-panel] after shell render");
  }
  renderPanel(panel);
}

function showTodayHome(root: HTMLElement): void {
  const queue = loadPlanQueue();
  const upcoming = peekUpcoming(queue, 3);
  const next = peekNextTemplate(queue);
  const forecast = forecastStripHtml(upcoming);
  const duration = templateDurationLabel(next);
  const targets = templateTargetsLabel(next.targetExerciseIds, ", ");

  renderShell(
    root,
    "today",
    `<div data-panel>
      <main class="shell">
        <p class="eyebrow">Aurora · Rassvet</p>
        <h1>Today</h1>
        <p class="tagline">Next in queue: <strong>${next.name}</strong> · ${duration}${
          targets ? ` → ${targets}` : ""
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
