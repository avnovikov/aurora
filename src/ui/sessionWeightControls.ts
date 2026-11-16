/**
 * Optional added-load controls for the work stage.
 * Zero kg → “Add 12 kg” (the athlete's own weight); otherwise − / kg / +.
 */
export function weightControlsHtml(loadKg: number, addKg: number): string {
  if (loadKg <= 0) {
    return `
      <div class="row work-load-row">
        <button type="button" class="btn-quiet" data-add-weight>Add weight · ${addKg} kg</button>
      </div>
    `;
  }
  return `
    <div class="row work-load-row">
      <button type="button" class="rest-step" data-load-minus>−</button>
      <span class="load-edit">${loadKg} kg</span>
      <button type="button" class="rest-step" data-load-plus>+</button>
    </div>
  `;
}
