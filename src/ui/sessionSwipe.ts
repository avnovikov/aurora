/** Commit when dragged past this share of stage width. */
export const SWIPE_COMMIT_RATIO = 1 / 3;
/** Flick speed (px/ms) that commits even short of the distance. */
export const SWIPE_FLICK_PX_PER_MS = 0.1;
/** Off-screen exit after a commit (visible finish). */
export const SWIPE_EXIT_MS = 360;
/** Snap-back when the swipe is cancelled. */
export const SWIPE_BACK_MS = 280;

export type SwipeDirection = "left" | "right";

export type SwipeDecision =
  | { action: "commit"; direction: SwipeDirection }
  | { action: "cancel" };

export function decideSwipeRelease(input: {
  deltaX: number;
  velocityPxPerMs: number;
  width: number;
}): SwipeDecision {
  const width = input.width;
  assertPositiveWidth(width);
  const threshold = width * SWIPE_COMMIT_RATIO;
  const flick = Math.abs(input.velocityPxPerMs) >= SWIPE_FLICK_PX_PER_MS;
  if (flick) {
    return {
      action: "commit",
      direction: input.velocityPxPerMs < 0 ? "left" : "right",
    };
  }
  if (Math.abs(input.deltaX) >= threshold) {
    return {
      action: "commit",
      direction: input.deltaX < 0 ? "left" : "right",
    };
  }
  return { action: "cancel" };
}

/** Only the forward swipe (right to left) commits; the other way snaps back. */
export function forwardOnly(decision: SwipeDecision): SwipeDecision {
  return decision.action === "commit" && decision.direction !== "left"
    ? { action: "cancel" }
    : decision;
}

export function exitOffsetPx(width: number, direction: SwipeDirection): number {
  assertPositiveWidth(width);
  const travel = width + 24;
  return direction === "left" ? -travel : travel;
}

function assertPositiveWidth(width: number): void {
  if (width <= 0) {
    throw new Error(`swipe width must be positive; got ${width}`);
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button, a, input") !== null;
}

/**
 * Right-to-left swipe on a session stage moves one step forward:
 * a work set is logged with its current values and rest starts,
 * a rest ends early and the next set begins.
 * Tracks 1:1 while the pointer is down, then animates off-screen
 * (or snaps back) so the gesture is visible before advancing.
 */
export function wireSwipe(stage: HTMLElement, onForward: () => void): void {
  let pointerId: number | null = null;
  let startX = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let deltaX = 0;
  let settling = false;

  const clearTransition = (): void => {
    stage.style.transition = "";
  };

  const applyDrag = (x: number): void => {
    stage.style.transform = `translateX(${x}px)`;
    const width = Math.max(stage.offsetWidth, 1);
    const fade = Math.min(1, Math.abs(x) / (width * 0.85));
    stage.style.opacity = String(1 - fade * 0.35);
  };

  const resetVisual = (): void => {
    stage.style.transform = "";
    stage.style.opacity = "";
    clearTransition();
    stage.classList.remove("is-swiping", "is-swipe-exit");
  };

  const settle = (decision: SwipeDecision): void => {
    settling = true;
    stage.classList.remove("is-swiping");
    const width = Math.max(stage.offsetWidth, 1);
    const reduced = prefersReducedMotion();

    if (decision.action === "cancel") {
      const duration = reduced ? 0 : SWIPE_BACK_MS;
      stage.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
      stage.style.transform = "translateX(0)";
      stage.style.opacity = "1";
      window.setTimeout(() => {
        resetVisual();
        settling = false;
      }, duration);
      return;
    }

    const target = exitOffsetPx(width, decision.direction);
    const duration = reduced ? 0 : SWIPE_EXIT_MS;
    stage.classList.add("is-swipe-exit");
    stage.style.transition = `transform ${duration}ms ease-in, opacity ${duration}ms ease-in`;
    stage.style.transform = `translateX(${target}px)`;
    stage.style.opacity = "0";
    window.setTimeout(() => {
      onForward();
      // paint() replaces the stage; still clear in case the step is a no-op.
      resetVisual();
      settling = false;
    }, duration);
  };

  stage.addEventListener("pointerdown", (event) => {
    if (settling || pointerId !== null || isInteractiveTarget(event.target)) {
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    lastX = event.clientX;
    lastT = event.timeStamp;
    velocity = 0;
    deltaX = 0;
    clearTransition();
    stage.classList.add("is-swiping");
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", (event) => {
    if (pointerId === null || event.pointerId !== pointerId || settling) {
      return;
    }
    const now = event.timeStamp;
    const dt = now - lastT;
    if (dt >= 8) {
      velocity = (event.clientX - lastX) / dt;
      lastX = event.clientX;
      lastT = now;
    }
    deltaX = event.clientX - startX;
    applyDrag(deltaX);
  });

  const endPointer = (event: PointerEvent): void => {
    if (pointerId === null || event.pointerId !== pointerId || settling) {
      return;
    }
    pointerId = null;
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    const width = Math.max(stage.offsetWidth, 1);
    settle(
      forwardOnly(
        decideSwipeRelease({
          deltaX,
          velocityPxPerMs: velocity,
          width,
        }),
      ),
    );
  };

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
}
