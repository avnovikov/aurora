import type { CaricatureId } from "./balance";
import backHeavy from "./caricatures/back-heavy.svg?raw";
import even from "./caricatures/even.svg?raw";
import frontHeavy from "./caricatures/front-heavy.svg?raw";
import lowerHeavy from "./caricatures/lower-heavy.svg?raw";
import lowerHinge from "./caricatures/lower-hinge.svg?raw";
import lowerSquat from "./caricatures/lower-squat.svg?raw";
import mostlyHinge from "./caricatures/mostly-hinge.svg?raw";
import mostlyPull from "./caricatures/mostly-pull.svg?raw";
import mostlyPush from "./caricatures/mostly-push.svg?raw";
import mostlySquat from "./caricatures/mostly-squat.svg?raw";
import pullUpper from "./caricatures/pull-upper.svg?raw";
import pushFront from "./caricatures/push-front.svg?raw";
import pushUpper from "./caricatures/push-upper.svg?raw";
import untrained from "./caricatures/untrained.svg?raw";
import upperFront from "./caricatures/upper-front.svg?raw";
import upperHeavy from "./caricatures/upper-heavy.svg?raw";

/**
 * Each file carries its own reduced-motion <style> for standalone viewing.
 * Inline, src/style.css holds one shared rule instead (`.bb-cari`), which
 * swaps the animated `cv-*-m` group for the still `cv-*-s` one.
 */
function inline(svg: string): string {
  return svg.replace(/<style>[\s\S]*?<\/style>\s*/, "").trim();
}

/** Balance caricatures (#234), inlined so the doodle CSS variables apply. */
export const CARICATURES: Readonly<Record<CaricatureId, string>> = {
  "back-heavy": inline(backHeavy),
  "even": inline(even),
  "front-heavy": inline(frontHeavy),
  "lower-heavy": inline(lowerHeavy),
  "lower-hinge": inline(lowerHinge),
  "lower-squat": inline(lowerSquat),
  "mostly-hinge": inline(mostlyHinge),
  "mostly-pull": inline(mostlyPull),
  "mostly-push": inline(mostlyPush),
  "mostly-squat": inline(mostlySquat),
  "pull-upper": inline(pullUpper),
  "push-front": inline(pushFront),
  "push-upper": inline(pushUpper),
  "untrained": inline(untrained),
  "upper-front": inline(upperFront),
  "upper-heavy": inline(upperHeavy),
};
