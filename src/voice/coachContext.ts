/**
 * Session-scoped flag: kettlebell work is active, or we are in the rest
 * immediately after a kettlebell set. Drives `kettlebellOnly` coach lines.
 */
let kettlebellCoachContext = false;

export function setKettlebellCoachContext(next: boolean): void {
  kettlebellCoachContext = next === true;
}

export function getKettlebellCoachContext(): boolean {
  return kettlebellCoachContext;
}
