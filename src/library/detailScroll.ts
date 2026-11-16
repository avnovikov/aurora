/**
 * Exercise detail opens at the top when the exercise changes.
 * Same-exercise re-paints (level, Not for me, plan status) keep the scroll.
 */
export interface ScrollViewport {
  scrollTo(x: number, y: number): void;
  scrollY?: number;
}

/** True when opening a different exercise than the one already on screen. */
export function shouldScrollDetailToTop(
  previousExerciseId: string | null,
  nextExerciseId: string,
): boolean {
  if (!nextExerciseId.trim()) {
    throw new Error("nextExerciseId must be non-empty");
  }
  return previousExerciseId !== nextExerciseId;
}

export function scrollViewportToTop(viewport: ScrollViewport = window): void {
  if (typeof viewport.scrollTo !== "function") {
    throw new Error("viewport.scrollTo must be a function");
  }
  viewport.scrollTo(0, 0);
}

export function readScrollY(viewport: ScrollViewport = window): number {
  return typeof viewport.scrollY === "number" ? viewport.scrollY : 0;
}

export function restoreScrollY(y: number, viewport: ScrollViewport = window): void {
  if (typeof viewport.scrollTo !== "function") {
    throw new Error("viewport.scrollTo must be a function");
  }
  if (!Number.isFinite(y) || y < 0) {
    throw new Error(`scrollY must be a non-negative finite number; got ${y}`);
  }
  viewport.scrollTo(0, y);
}
