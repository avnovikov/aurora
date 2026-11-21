import { isBodyViewMode, type BodyViewMode } from "../body/aggregate";
import {
  BODY_WINDOWS,
  WINDOW_LABELS,
  areaName,
  buildBalanceModel,
  hasWork,
  pairLabel,
  pairShares,
  type BalanceModel,
  type PairResult,
} from "../body/balance";
import { CARICATURES } from "../body/caricatureSvgs";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { MuscleGroup } from "../domain/types";
import { escapeHtml } from "../library/present";
import { loadExcluded } from "../plan/exclusions";
import { loadHistory, loadMemories } from "../session/history";
import { loadProfile } from "../settings/profile";
import { renderBalanceFigure, updateBalanceFigure } from "./bodyMap";
import { prefersReducedMotion } from "./motion";

export interface BodyViewOptions {
  /** Window to open on (Back from an exercise restores the one that was left). */
  mode?: BodyViewMode;
  /** A "Consider adding" row was tapped. */
  onOpenExercise?: (exerciseId: string, mode: BodyViewMode) => void;
  /** Clock override for tests. */
  nowMs?: number;
}

const FIGURE_SETTLE_MS = 320;
/** Stands in for the figure on a repaint; the drawn one is moved into it. */
const FIGURE_SLOT = "<i data-bb-slot></i>";

/** Body tab (#234): what is the balance? */
export function renderBodyView(root: HTMLElement, options: BodyViewOptions = {}): void {
  let mode: BodyViewMode = options.mode ?? "overall";
  const history = loadHistory();
  const profile = loadProfile();
  const excluded = loadExcluded();
  const memories = loadMemories();

  const paint = (): void => {
    const model = buildBalanceModel({
      mode,
      nowMs: options.nowMs ?? Date.now(),
      history,
      graph: EXERCISE_GRAPH,
      equipment: profile.equipment,
      jointHistory: profile.jointHistory,
      excluded,
      memories,
    });
    // Keep the drawn figure so its regions animate to the new levels.
    const previousFigure = root.querySelector(".bb-hero");
    root.innerHTML = bodyHtml(model, previousFigure ? FIGURE_SLOT : renderBalanceFigure(model.levels));
    if (previousFigure) {
      root.querySelector("[data-bb-slot]")?.replaceWith(previousFigure);
      updateBalanceFigure(previousFigure, model.levels, prefersReducedMotion() ? 0 : FIGURE_SETTLE_MS);
    }
    wire(model);
  };

  const wire = (model: BalanceModel): void => {
    root.querySelectorAll<HTMLButtonElement>("[data-body-window]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.bodyWindow ?? "";
        if (isBodyViewMode(next) && next !== mode) {
          mode = next;
          paint();
        }
      });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-open-exercise]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.openExercise;
        if (id) {
          options.onOpenExercise?.(id, model.mode);
        }
      });
    });
  };

  paint();
}

function bodyHtml(model: BalanceModel, figureHtml: string): string {
  const ready = model.state === "ready";
  return `
    <main class="shell body-balance" data-state="${model.state}">
      <header class="bb-head">
        <div>
          <h1 class="bb-title">Body</h1>
          ${model.state === "empty" ? "" : `<p class="bb-verdict">${escapeHtml(model.headline)}</p>`}
          ${model.subline ? `<p class="bb-sub">${escapeHtml(model.subline)}</p>` : ""}
        </div>
        <div class="bb-cari" data-caricature="${model.caricature}">${CARICATURES[model.caricature]}</div>
      </header>
      ${windowControl(model)}
      ${model.state === "empty" ? `<p class="bb-empty">${escapeHtml(model.headline)}</p>` : `<p class="bb-note">${windowCaption(model.mode)}</p>`}
      ${model.state === "no_sessions" && model.tryMode ? tryWindow(model.tryMode) : ""}
      <section class="bb-fig" aria-label="Body, front and back, sized by level">
        ${figureHtml}
        <div class="bb-caps" aria-hidden="true"><span>Front</span><span>Back</span></div>
        ${keyHtml()}
        ${ready ? levelLines(model) : ""}
      </section>
      ${model.state === "empty" ? "" : balanceRows(model)}
      ${ready ? movesHtml(model) : ""}
      ${ready ? footnotes() : ""}
    </main>`;
}

function windowControl(model: BalanceModel): string {
  const buttons = BODY_WINDOWS.map((item) => {
    const current = item === model.mode;
    return `<button type="button" data-body-window="${item}"${current ? ' aria-current="true"' : ""}>${WINDOW_LABELS[item]}</button>`;
  }).join("");
  return `<nav class="bb-win" aria-label="Time window">${buttons}</nav>`;
}

function windowCaption(mode: BodyViewMode): string {
  if (mode === "overall") {
    return "Recent training, older sessions fade";
  }
  return "Every session in this window counts the same";
}

function tryWindow(next: BodyViewMode): string {
  return `<p class="bb-try"><button type="button" class="bb-try-btn" data-body-window="${next}">Try ${WINDOW_LABELS[next]}</button></p>`;
}

function keyHtml(): string {
  const swatch = (code: string, inset: number): string => {
    const size = 32 - 2 * inset;
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="bb-sw" data-l="${code}" x="${inset}" y="${inset}" width="${size}" height="${size}" rx="2"/></svg>`;
  };
  return `
    <ul class="bb-key" aria-label="Level key">
      <li>${swatch("h", 2.6)}<b>Heavy</b><span>fuller</span></li>
      <li>${swatch("m", 4)}<b>Moderate</b><span>as drawn</span></li>
      <li>${swatch("l", 5.8)}<b>Light</b><span>thinner</span></li>
      <li>${swatch("n", 5.8)}<b>Not trained</b><span>hollow</span></li>
    </ul>`;
}

function areaList(areas: readonly MuscleGroup[]): string {
  return escapeHtml(areas.map(areaName).join(", "));
}

function levelLines(model: BalanceModel): string {
  const lines = [
    model.notTrained.length > 0 ? `<p><b>Not trained:</b> ${areaList(model.notTrained)}</p>` : "",
    model.lighter.length > 0 ? `<p><b>Lighter than the rest:</b> ${areaList(model.lighter)}</p>` : "",
  ].join("");
  return lines ? `<div class="bb-lines">${lines}</div>` : "";
}

function balanceRow(pair: PairResult, accent: boolean): string {
  const worked = hasWork(pair);
  const muted = worked ? "" : " data-muted";
  const [first, second] = pairShares(pair);
  const shares = worked ? `${first} / ${second}` : "";
  return `
    <div class="bb-row" data-pair="${pair.id}" data-kind="${pair.kind}">
      <div class="bb-top">
        <span class="bb-lab">${escapeHtml(pairLabel(pair))}</span>
        <span class="bb-word"${accent ? " data-hot" : ""}${muted}>${escapeHtml(pair.word)}</span>
        <span class="bb-sh">${shares}</span>
      </div>
      <div class="bb-bar" aria-hidden="true"><i style="flex:${first}"></i><i style="flex:${second}"></i></div>
    </div>`;
}

function balanceRows(model: BalanceModel): string {
  return `
    <section class="bb-bal" aria-label="Balance">
      ${model.pairs.map((pair) => balanceRow(pair, pair.id === model.accent)).join("")}
    </section>`;
}

function movesHtml(model: BalanceModel): string {
  if (model.moves.length === 0) {
    return "";
  }
  const rows = model.moves
    .map(
      (move) => `
        <li><button type="button" class="bb-move" data-open-exercise="${escapeHtml(move.exerciseId)}">
          <span class="bb-nm">${escapeHtml(move.name)}</span>
          <span class="bb-ar">${areaList(move.areas)}</span>
          <i class="bb-chev" aria-hidden="true"></i>
        </button></li>`,
    )
    .join("");
  return `
    <section class="bb-add" aria-label="Consider adding">
      <h2 class="bb-h2">Consider adding</h2>
      <ul>${rows}</ul>
      <p class="bb-foot">Your plan is not changed.</p>
    </section>`;
}

function footnotes(): string {
  return `
    <div class="bb-notes">
      <p>Compared with your other trained areas in this window.</p>
      <p>Even means within 2:1. A coaching convention, not a medical norm.</p>
      <p>Push, pull, squat and hinge count the sets logged for each move. Older sessions without a set log split their sets evenly across their moves. In Overall, older sessions fade.</p>
      <p>Core, conditioning and mobility sit outside the movement pairs; core has its own row, Abs v Lower back.</p>
      <p>Front v Back and Abs v Lower back use the figure's area scores: sets in Overall, moves that trained the area in the other windows. Front v Back leaves out shoulders, forearms, neck, adductors and abductors.</p>
    </div>`;
}
