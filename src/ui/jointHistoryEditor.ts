import type { InjuryKind, JointHistoryEntry, JointId, JointSide } from "../domain/program";
import {
  INJURY_KINDS,
  JOINT_IDS,
  JOINT_LABEL,
  SIDES,
  isSided,
  toggleJoint,
  updateEntry,
} from "../settings/jointHistory";

function chip(attr: string, value: string, label: string, on: boolean): string {
  return `<button type="button" ${attr}="${value}" class="${on ? "selected" : ""}">${label}</button>`;
}

function detailHtml(entry: JointHistoryEntry): string {
  const sides = isSided(entry.joint)
    ? `<div class="row wrap">${SIDES.map((side) =>
        chip("data-hj-side", `${entry.joint}:${side}`, side, entry.side === side),
      ).join("")}</div>`
    : "";
  const kinds = `<div class="row wrap">${INJURY_KINDS.map((kind) =>
    chip("data-hj-kind", `${entry.joint}:${kind.id}`, kind.label, entry.kind === kind.id),
  ).join("")}</div>`;
  return `<div class="hj-detail"><p class="tagline">${JOINT_LABEL[entry.joint]}</p>${sides}${kinds}</div>`;
}

export function jointHistoryEditorHtml(entries: readonly JointHistoryEntry[]): string {
  const chips = JOINT_IDS.map((joint) =>
    chip("data-hj", joint, JOINT_LABEL[joint], entries.some((e) => e.joint === joint)),
  ).join("");
  return `<div class="row wrap">${chips}</div>${entries.map(detailHtml).join("")}`;
}

/** Renders the editor into `container`; calls `onChange` with every new state. */
export function mountJointHistoryEditor(
  container: HTMLElement,
  initial: readonly JointHistoryEntry[],
  onChange: (entries: JointHistoryEntry[]) => void,
): void {
  let entries = [...initial];
  const apply = (next: JointHistoryEntry[]): void => {
    entries = next;
    onChange(entries);
    paint();
  };
  const paint = (): void => {
    container.innerHTML = jointHistoryEditorHtml(entries);
    container.querySelectorAll<HTMLButtonElement>("[data-hj]").forEach((button) =>
      button.addEventListener("click", () =>
        apply(toggleJoint(entries, button.dataset.hj as JointId)),
      ),
    );
    container.querySelectorAll<HTMLButtonElement>("[data-hj-side]").forEach((button) =>
      button.addEventListener("click", () => {
        const [joint, side] = button.dataset.hjSide!.split(":");
        apply(updateEntry(entries, joint as JointId, { side: side as JointSide }));
      }),
    );
    container.querySelectorAll<HTMLButtonElement>("[data-hj-kind]").forEach((button) =>
      button.addEventListener("click", () => {
        const [joint, kind] = button.dataset.hjKind!.split(":");
        apply(updateEntry(entries, joint as JointId, { kind: kind as InjuryKind }));
      }),
    );
  };
  paint();
}
