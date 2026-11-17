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

/** True while a drag stays close enough to horizontal to count as a swipe. */
export function withinSwipeAngle(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaY) <= Math.abs(deltaX) * SWIPE_MAX_SLOPE;
}

/**
 * A deliberate swipe only. Speed never commits: a short or fast flick snaps back.
 * The drag must
 * - travel a quarter of the width,
 * - stay within the angle, and
 * - be let go inside the last fifth of the stage on the side it moved toward.
 * `releaseX` is measured from the stage's left edge.
 */
export function decideSwipeRelease(input: {
  deltaX: number;
  deltaY: number;
  releaseX: number;
  width: number;
}): SwipeDecision {
  const { deltaX, deltaY, releaseX, width } = input;
  assertPositiveWidth(width);
  if (Math.abs(deltaX) < width * SWIPE_MIN_TRAVEL_RATIO || !withinSwipeAngle(deltaX, deltaY)) {
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

/** Which way a drag has locked while the page can also scroll. */
export type SwipeAxis = "horizontal" | "vertical" | "pending";

const AXIS_SLOP_PX = 8;

/**
 * Pending while both axes stay inside the slop.
 * The longer travel then wins, and a tie stays horizontal.
 */
export function swipeAxis(deltaX: number, deltaY: number): SwipeAxis {
  const travelX = Math.abs(deltaX);
  const travelY = Math.abs(deltaY);
  if (travelX < AXIS_SLOP_PX && travelY < AXIS_SLOP_PX) {
    return "pending";
  }
  if (travelX > travelY) {
    return "horizontal";
  }
  if (travelY > travelX) {
    return "vertical";
  }
  return "pending";
}

export interface WireSwipeOptions {
  /** Which commit directions count; defaults to session forward (left). */
  allow?: (decision: SwipeDecision) => SwipeDecision;
  /** Drop the gesture when vertical scrolling wins before a horizontal lock. */
  preferVerticalScroll?: boolean;
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
 * Horizontal swipe on a stage. The pointer tracks 1:1, then the stage
 * animates off-screen or snaps back. Session commits forward (left).
 * Library detail commits back (right) and yields when vertical scroll wins.
 */
export function wireSwipe(
  stage: HTMLElement,
  onCommit: () => void,
  options: WireSwipeOptions = {},
): void {
  const { allow = forwardOnly, preferVerticalScroll = false } = options;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;
  let releaseX = 0;
  /** Stage left edge at touch-down; the drag transform moves the live rect. */
  let stageLeft = 0;
  /** Once a drag leaves the angle it is dead until the finger lifts. */
  let offAxis = false;
  let axis: SwipeAxis = "pending";
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

  const abandonForScroll = (event: PointerEvent): void => {
    pointerId = null;
    axis = "pending";
    releasePointer(stage, event.pointerId);
    resetVisual();
  };

  const isTracking = (event: PointerEvent): boolean => {
    return pointerId !== null && event.pointerId === pointerId && !settling;
  };

  const shouldDragStage = (event: PointerEvent, travelX: number): boolean => {
    if (!preferVerticalScroll) {
      return true;
    }
    if (axis === "pending") {
      axis = swipeAxis(travelX, event.clientY - startY);
    }
    if (axis === "vertical") {
      abandonForScroll(event);
      return false;
    }
    return axis === "horizontal";
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
      onCommit();
      // paint() replaces the stage; still clear in case the step is a no-op.
      resetVisual();
      settling = false;
    }, duration);
  };

  const captureWhenReady = (event: PointerEvent): void => {
    if (preferVerticalScroll && axis !== "horizontal") {
      return;
    }
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
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    deltaX = 0;
    deltaY = 0;
    releaseX = 0;
    stageLeft = stage.getBoundingClientRect().left;
    offAxis = false;
    axis = "pending";
    clearTransition();
    if (!preferVerticalScroll) {
      stage.classList.add("is-swiping");
      captureWhenReady(event);
    }
  });

  stage.addEventListener("pointermove", (event) => {
    if (!isTracking(event)) {
      return;
    }
    deltaX = event.clientX - startX;
    deltaY = event.clientY - startY;
    releaseX = event.clientX - stageLeft;
    if (!shouldDragStage(event, deltaX)) {
      return;
    }
    if (preferVerticalScroll && !stage.classList.contains("is-swiping")) {
      stage.classList.add("is-swiping");
      captureWhenReady(event);
    }
    if (!offAxis && swipeAxis(deltaX, deltaY) !== "pending") {
      offAxis = !withinSwipeAngle(deltaX, deltaY);
    }
    applyDrag(offAxis ? 0 : deltaX);
  });

  const endPointer = (event: PointerEvent): void => {
    if (!isTracking(event)) {
      return;
    }
    pointerId = null;
    releasePointer(stage, event.pointerId);
    if (preferVerticalScroll && axis !== "horizontal") {
      resetVisual();
      return;
    }
    const width = Math.max(stage.offsetWidth, 1);
    const decision = offAxis
      ? ({ action: "cancel" } as const)
      : decideSwipeRelease({ deltaX, deltaY, releaseX, width });
    settle(allow(decision));
  };

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", (event) => {
    if (!isTracking(event)) {
      return;
    }
    pointerId = null;
    axis = "pending";
    releasePointer(stage, event.pointerId);
    resetVisual();
  });
}
