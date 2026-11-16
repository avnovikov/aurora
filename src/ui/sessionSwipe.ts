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
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let deltaX = 0;
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
    lastX = event.clientX;
    lastT = event.timeStamp;
    velocity = 0;
    deltaX = 0;
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
    const now = event.timeStamp;
    const elapsed = now - lastT;
    if (elapsed >= 8) {
      velocity = (event.clientX - lastX) / elapsed;
      lastX = event.clientX;
      lastT = now;
    }
    deltaX = event.clientX - startX;
    if (!shouldDragStage(event, deltaX)) {
      return;
    }
    if (preferVerticalScroll && !stage.classList.contains("is-swiping")) {
      stage.classList.add("is-swiping");
      captureWhenReady(event);
    }
    applyDrag(deltaX);
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
    settle(
      allow(
        decideSwipeRelease({
          deltaX,
          velocityPxPerMs: velocity,
          width,
        }),
      ),
    );
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
