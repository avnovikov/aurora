export interface WarmupLightenConfirmOptions {
  onLight: () => void;
  onKeep: () => void;
}

/** End-of-warmup confirm: keep it light vs continue as planned. */
export function warmupLightenConfirmHtml(preferLight: boolean): string {
  const lightClass = preferLight ? "cta" : "btn-quiet";
  const keepClass = preferLight ? "btn-quiet" : "cta";
  return `
    <section class="shell" data-warmup-lighten>
      <p class="eyebrow">Warm-up</p>
      <h1>You look wound up</h1>
      <p class="tagline">Same moves, lighter dose — or keep the plan as written.</p>
      <div class="row wrap">
        <button type="button" class="${lightClass}" data-lighten-yes>Keep it light</button>
        <button type="button" class="${keepClass}" data-lighten-no>Keep the plan</button>
      </div>
    </section>
  `;
}

export function wireWarmupLightenConfirm(
  root: HTMLElement,
  options: WarmupLightenConfirmOptions,
): void {
  root.querySelector("[data-lighten-yes]")?.addEventListener("click", () => options.onLight());
  root.querySelector("[data-lighten-no]")?.addEventListener("click", () => options.onKeep());
}
