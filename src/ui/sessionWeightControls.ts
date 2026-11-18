/**
 * Optional added-load controls for the work stage.
 * Zero kg → “Add your 12 kg” (the athlete's own weight, never a prescribed load); otherwise − / kg / +.
 */
export function weightControlsHtml(loadKg: number, addKg: number): string {
  if (loadKg <= 0) {
    return `
      <div class="row work-load-row">
        <button type="button" class="btn-quiet" data-add-weight>Add your ${addKg} kg</button>
      </div>
    `;
  }
  return `
    <div class="row work-load-row">
      <button type="button" class="rest-step" data-load-minus aria-label="Less weight">−</button>
      <span class="load-edit" aria-live="polite">${loadKg} kg</span>
      <button type="button" class="rest-step" data-load-plus aria-label="More weight">+</button>
    </div>
  `;
}
