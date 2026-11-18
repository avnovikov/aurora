const DELOAD_NOTE =
  "Deload week on — lighter dose, no level-ups. Turn it off in Settings.";

/** Home tagline paragraph shown only while a deload week is active. */
export function deloadNoteHtml(deloadActive: boolean): string {
  if (!deloadActive) {
    return "";
  }
  return `<p class="tagline" data-deload-note>${DELOAD_NOTE}</p>`;
}
