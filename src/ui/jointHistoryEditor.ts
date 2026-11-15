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

function detailHtml(entry: JointHistoryEntry): string {
  const sides = isSided(entry.joint)
    ? `<div class="row wrap">${SIDES.map((side) =>
        chipHtml("hj-side", `${entry.joint}:${side}`, side, entry.side === side),
      ).join("")}</div>`
    : "";
  const kinds = `<div class="row wrap">${INJURY_KINDS.map((kind) =>
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
