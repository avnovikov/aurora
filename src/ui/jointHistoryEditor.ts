import { chipHtml, onChipClick } from "../library/chips";
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

const SIDE_LABEL: Record<JointSide, string> = { left: "Left", right: "Right", both: "Both" };

function detailHtml(entry: JointHistoryEntry): string {
  const sides = isSided(entry.joint)
    ? `<div class="row wrap" role="group" aria-label="Which ${JOINT_LABEL[entry.joint].toLowerCase()}">${SIDES.map((side) =>
        chipHtml("hj-side", `${entry.joint}:${side}`, SIDE_LABEL[side], entry.side === side),
      ).join("")}</div>`
    : "";
  const kinds = `<div class="row wrap" role="group" aria-label="What happened to your ${JOINT_LABEL[entry.joint].toLowerCase()}">${INJURY_KINDS.map((kind) =>
    chipHtml("hj-kind", `${entry.joint}:${kind.id}`, kind.label, entry.kind === kind.id),
  ).join("")}</div>`;
  return `<div class="hj-detail"><p class="tagline">${JOINT_LABEL[entry.joint]}</p>${sides}${kinds}</div>`;
}

function jointHistoryEditorHtml(entries: readonly JointHistoryEntry[]): string {
  const chips = JOINT_IDS.map((joint) =>
    chipHtml("hj", joint, JOINT_LABEL[joint], entries.some((e) => e.joint === joint)),
  ).join("");
  return `<div class="row wrap">${chips}</div>${entries.map(detailHtml).join("")}`;
}

const CHIP_ATTRS = ["data-hj", "data-hj-side", "data-hj-kind"] as const;

/** Which chip an element is, so the same chip can be found after a repaint. */
function chipKey(element: HTMLElement): { attr: string; value: string } | null {
  for (const attr of CHIP_ATTRS) {
    const value = element.getAttribute(attr);
    if (value !== null) {
      return { attr, value };
    }
  }
  return null;
}

/** Renders the editor into `container`; calls `onChange` with every new state. */
export function mountJointHistoryEditor(
  container: HTMLElement,
  initial: readonly JointHistoryEntry[],
  onChange: (entries: JointHistoryEntry[]) => void,
): void {
  let entries = [...initial];
  const apply = (next: JointHistoryEntry[]): void => {
    // Repainting replaces the chips; put focus back on the one just pressed (WCAG 2.4.3).
    const pressed = document.activeElement;
    const key = pressed instanceof HTMLElement && container.contains(pressed) ? chipKey(pressed) : null;
    entries = next;
    onChange(entries);
    paint();
    if (key) {
      container.querySelector<HTMLElement>(`[${key.attr}="${CSS.escape(key.value)}"]`)?.focus();
    }
  };
  const paint = (): void => {
    container.innerHTML = jointHistoryEditorHtml(entries);
    onChipClick(container, "hj", (joint) => apply(toggleJoint(entries, joint as JointId)));
    onChipClick(container, "hj-side", (value) => {
      const [joint, side] = value.split(":");
      apply(updateEntry(entries, joint as JointId, { side: side as JointSide }));
    });
    onChipClick(container, "hj-kind", (value) => {
      const [joint, kind] = value.split(":");
      apply(updateEntry(entries, joint as JointId, { kind: kind as InjuryKind }));
    });
  };
  paint();
}
