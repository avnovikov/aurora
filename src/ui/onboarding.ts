import { addBlockToPlan } from "../plan/blockActions";
import type { AreaKind } from "../plan/dayKinds";
import { savePlanQueue } from "../plan/queue";
import { loadProfile, saveProfile } from "../settings/profile";
import { loadAthleteState } from "./athleteState";
import { renderOnboardingTarget } from "./onboardingTarget";
import { renderSettingsView } from "./settingsView";
import type { AppTab } from "./shell";

/** Clears the seed programme so a fresh install starts with an empty plan. */
export function beginOnboardingQueue(): void {
  savePlanQueue({ items: [] });
}

function markSetupDone(): void {
  saveProfile({ ...loadProfile(), setupDone: true });
}

/** Build the first area block and mark setup finished. */
export function completeOnboardingWithArea(area: AreaKind): void {
  const { queue } = addBlockToPlan({
    kind: area,
    context: loadAthleteState(),
    queue: { items: [] },
    index: 0,
  });
  savePlanQueue(queue);
  markSetupDone();
}

/** Leave the plan empty and mark setup finished. */
export function completeOnboardingSkip(): void {
  beginOnboardingQueue();
  markSetupDone();
}

/**
 * Fresh install: Settings (no app tabs) → Target (area or Skip) → caller opens Plan.
 */
export function renderOnboarding(root: HTMLElement, onDone: (tab: AppTab) => void): void {
  beginOnboardingQueue();

  const finish = (): void => onDone("plan");

  renderSettingsView(root, {
    onContinue: () => {
      renderOnboardingTarget(root, {
        onChoose: (area) => {
          completeOnboardingWithArea(area);
          finish();
        },
        onSkip: () => {
          completeOnboardingSkip();
          finish();
        },
      });
    },
  });
}
