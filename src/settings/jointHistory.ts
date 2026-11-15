import type {
  InjuryKind,
  JointHistoryEntry,
  JointId,
  JointSide,
} from "../domain/program";

export const JOINT_IDS: readonly JointId[] = [
  "shoulder",
  "elbow",
  "wrist",
  "hip",
  "knee",
  "ankle",
  "lumbar",
];

export const JOINT_LABEL: Record<JointId, string> = {
  shoulder: "Shoulder",
  elbow: "Elbow",
  wrist: "Wrist",
  hip: "Hip",
  knee: "Knee",
  ankle: "Ankle",
  lumbar: "Lower back",
};

export const SIDES: readonly JointSide[] = ["left", "right", "both"];

export const INJURY_KINDS: ReadonlyArray<{ id: InjuryKind; label: string }> = [
  { id: "dislocation", label: "Dislocation" },
  { id: "ligament", label: "Ligament / tendon" },
  { id: "surgery", label: "Surgery" },
  { id: "other", label: "Other / niggles" },
];

/** The lower back has no left/right. */
export function isSided(joint: JointId): boolean {
  return joint !== "lumbar";
}

/** "left shoulder", "both knees", "lower back". */
export function describeEntry(entry: JointHistoryEntry): string {
  const name = JOINT_LABEL[entry.joint].toLowerCase();
  if (!isSided(entry.joint)) {
    return name;
  }
  return entry.side === "both" ? `both ${name}s` : `${entry.side} ${name}`;
}

export function toggleJoint(
  entries: readonly JointHistoryEntry[],
  joint: JointId,
): JointHistoryEntry[] {
  if (entries.some((entry) => entry.joint === joint)) {
    return entries.filter((entry) => entry.joint !== joint);
  }
  return [...entries, { joint, side: "both", kind: "other" }];
}

export function updateEntry(
  entries: readonly JointHistoryEntry[],
  joint: JointId,
  patch: Partial<Pick<JointHistoryEntry, "side" | "kind">>,
): JointHistoryEntry[] {
  return entries.map((entry) =>
    entry.joint === joint ? { ...entry, ...patch } : entry,
  );
}

export function isJointHistory(value: unknown): value is JointHistoryEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        JOINT_IDS.includes(item?.joint) &&
        SIDES.includes(item?.side) &&
        INJURY_KINDS.some((kind) => kind.id === item?.kind),
    )
  );
}
