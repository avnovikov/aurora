import { chipHtml } from "../library/chips";
import { AREA_KINDS, DAY_KIND_LABELS, type AreaKind } from "../plan/dayKinds";

export interface OnboardingTargetCallbacks {
  onChoose: (area: AreaKind) => void;
  onSkip: () => void;
}

function isAreaKind(value: string | undefined): value is AreaKind {
  return AREA_KINDS.some((kind) => kind === value);
}

export function onboardingTargetHtml(selected: AreaKind | null): string {
  const chips = AREA_KINDS.map((kind) =>
    chipHtml("area", kind, DAY_KIND_LABELS[kind], kind === selected),
  ).join("");
  const startDisabled = selected ? "" : " disabled";
  return `
    <main class="shell onboarding-target">
      <p class="eyebrow">Setup</p>
      <h1>What to train first</h1>
      <p class="tagline">This shapes the first days. You can change it any time on Plan.</p>
      <p class="chip-row-label">Area</p>
      <div class="row wrap" role="group" aria-label="First training area">
        ${chips}
      </div>
      <button type="button" class="cta" data-start${startDisabled}>Start with this</button>
      <button type="button" data-skip>Skip for now</button>
    </main>
  `;
}

/** First-run: pick an area for the first block, or skip and leave Plan empty. */
export function renderOnboardingTarget(root: HTMLElement, callbacks: OnboardingTargetCallbacks): void {
  let selected: AreaKind | null = null;

  const paint = (): void => {
    root.innerHTML = onboardingTargetHtml(selected);

    root.querySelectorAll<HTMLButtonElement>("[data-area]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!isAreaKind(button.dataset.area)) {
          return;
        }
        selected = button.dataset.area;
        paint();
      });
    });

    root.querySelector("[data-start]")?.addEventListener("click", () => {
      if (selected) {
        callbacks.onChoose(selected);
      }
    });

    root.querySelector("[data-skip]")?.addEventListener("click", () => callbacks.onSkip());
  };

  paint();
}
