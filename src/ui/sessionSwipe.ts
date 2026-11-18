/** Minimum horizontal travel, as a share of stage width, before a commit. */
export const SWIPE_MIN_TRAVEL_RATIO = 1 / 4;
/** The finger must be let go inside this far edge share of the stage. */
export const SWIPE_RELEASE_ZONE_RATIO = 1 / 5;
/**
 * Most vertical travel per unit of horizontal travel (Android ViewPager's
 * `dx * 0.5 > dy` rule, about 26.6 degrees). A drag along the horizontal or
 * one notch above or below it (22.5 degrees) counts. A drag at 45 degrees
 * or steeper does not.
 */
export const SWIPE_MAX_SLOPE = 0.5;
/** Off-screen exit after a commit (visible finish). */
export const SWIPE_EXIT_MS = 360;
/** Snap-back when the swipe is cancelled. */
export const SWIPE_BACK_MS = 280;

export type SwipeDirection = "left" | "right";

export type SwipeDecision =
  | { action: "commit"; direction: SwipeDirection }
  | { action: "cancel" };

/**
 * Release of a horizontal drag (the angle is already enforced by `swipeAxis`).
 * Speed never commits: a short or fast flick snaps back. The drag must travel
 * a quarter of the width and be let go inside the last fifth of the stage on
 * the side it moved toward. `releaseX` is measured from the stage's left edge.
 */
export function decideSwipeRelease(input: {
  deltaX: number;
  releaseX: number;
  width: number;
}): SwipeDecision {
  const { deltaX, releaseX, width } = input;
  assertPositiveWidth(width);
  if (Math.abs(deltaX) < width * SWIPE_MIN_TRAVEL_RATIO) {
    return { action: "cancel" };
  }
  const zone = width * SWIPE_RELEASE_ZONE_RATIO;
  const direction: SwipeDirection = deltaX < 0 ? "left" : "right";
  const inZone = direction === "left" ? releaseX <= zone : releaseX >= width - zone;
  return inZone ? { action: "commit", direction } : { action: "cancel" };
}

/** Only the forward swipe (right to left) commits; the other way snaps back. */
export function forwardOnly(decision: SwipeDecision): SwipeDecision {
  return commitInDirection(decision, "left");
}

/** Only the back swipe (left to right) commits; the other way snaps back. */
export function backOnly(decision: SwipeDecision): SwipeDecision {
  return commitInDirection(decision, "right");
}

function commitInDirection(decision: SwipeDecision, direction: SwipeDirection): SwipeDecision {
  const wrongWay = decision.action === "commit" && decision.direction !== direction;
  if (wrongWay) {
    return { action: "cancel" };
  }
  return decision;
}

/** Which way a drag reads: a swipe, a scroll (or any off-angle drag), or not yet known. */
export type SwipeAxis = "horizontal" | "vertical" | "pending";

const AXIS_SLOP_PX = 8;

/**
 * Pending while both axes stay inside the slop. After that, horizontal only
 * while the drag stays within `SWIPE_MAX_SLOPE`; anything steeper is vertical.
 */
export function swipeAxis(deltaX: number, deltaY: number): SwipeAxis {
  const travelX = Math.abs(deltaX);
  const travelY = Math.abs(deltaY);
  if (travelX < AXIS_SLOP_PX && travelY < AXIS_SLOP_PX) {
    return "pending";
  }
  return travelY <= travelX * SWIPE_MAX_SLOPE ? "horizontal" : "vertical";
}

export interface WireSwipeOptions {
  /** Which commit directions count; defaults to session forward (left). */
  allow?: (decision: SwipeDecision) => SwipeDecision;
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
  return (
    target instanceof Element &&
    target.closest("button, a, input, select, label, textarea") !== null
  );
}

function releasePointer(stage: HTMLElement, pointerId: number): void {
  try {
    stage.releasePointerCapture(pointerId);
  } catch {
    // Already released.
  }
}

/**
 * Horizontal swipe on a stage. Once the drag clears the slop within the angle,
 * the stage follows the finger, then animates off-screen or snaps back.
 * A drag that is ever steeper than the angle is dropped for the rest of the
 * gesture, so the page can scroll. Session commits forward (left); library
 * detail commits back (right).
 */
export function wireSwipe(
  stage: HTMLElement,
  onCommit: () => void,
  options: WireSwipeOptions = {},
): void {
  const { allow = forwardOnly } = options;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  /** Touch-down point from the stage's left edge (before any drag transform). */
  let startOffsetX = 0;
  let width = 1;
  let deltaX = 0;
  let axis: SwipeAxis = "pending";
  let settling = false;

  const clearTransition = (): void => {
    stage.style.transition = "";
  };

  const applyDrag = (x: number): void => {
    stage.style.transform = `translateX(${x}px)`;
    const fade = Math.min(1, Math.abs(x) / (width * 0.85));
    stage.style.opacity = String(1 - fade * 0.35);
  };

  const resetVisual = (): void => {
    stage.style.transform = "";
    stage.style.opacity = "";
    clearTransition();
    stage.classList.remove("is-swiping", "is-swipe-exit");
  };

  /** Drop the gesture for good: the finger lifting later does nothing. */
  const abandon = (event: PointerEvent): void => {
    pointerId = null;
    axis = "pending";
    releasePointer(stage, event.pointerId);
    resetVisual();
  };

  const isTracking = (event: PointerEvent): boolean => {
    return pointerId !== null && event.pointerId === pointerId && !settling;
  };

  const settle = (decision: SwipeDecision): void => {
    settling = true;
    stage.classList.remove("is-swiping");
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
      onCommit();
      // paint() replaces the stage; still clear in case the step is a no-op.
      resetVisual();
      settling = false;
    }, duration);
  };

  const lockHorizontal = (event: PointerEvent): void => {
    stage.classList.add("is-swiping");
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional once the browser already owns the pointer.
    }
  };

  stage.addEventListener("pointerdown", (event) => {
    if (settling || pointerId !== null || isInteractiveTarget(event.target)) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startOffsetX = event.clientX - rect.left;
    width = Math.max(rect.width, 1);
    deltaX = 0;
    axis = "pending";
    clearTransition();
  });

  stage.addEventListener("pointermove", (event) => {
    if (!isTracking(event)) {
      return;
    }
    deltaX = event.clientX - startX;
    const next = swipeAxis(deltaX, event.clientY - startY);
    if (next === "vertical") {
      abandon(event);
      return;
    }
    if (next === "pending") {
      return;
    }
    if (axis !== "horizontal") {
      axis = "horizontal";
      lockHorizontal(event);
    }
    applyDrag(deltaX);
  });

  const endPointer = (event: PointerEvent): void => {
    if (!isTracking(event)) {
      return;
    }
    pointerId = null;
    releasePointer(stage, event.pointerId);
    if (axis !== "horizontal") {
      resetVisual();
      return;
    }
    axis = "pending";
    settle(allow(decideSwipeRelease({ deltaX, releaseX: startOffsetX + deltaX, width })));
  };

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", (event) => {
    if (isTracking(event)) {
      abandon(event);
    }
  });
}
