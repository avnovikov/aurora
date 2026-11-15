/** Commit when dragged past this share of stage width. */
export const SWIPE_COMMIT_RATIO = 1 / 3;
/** Flick speed (px/ms) that commits even short of the distance. */
export const SWIPE_FLICK_PX_PER_MS = 0.1;
/** Off-screen exit after a commit (visible finish). */
export const SWIPE_EXIT_MS = 360;
/** Snap-back when the swipe is cancelled. */
export const SWIPE_BACK_MS = 280;

export type SwipeDirection = "left" | "right";

/** Which horizontal commits are allowed. Rest uses `"right"` only. */
export type CommitDirections = "both" | "right";

export type SwipeDecision =
  | { action: "commit"; direction: SwipeDirection }
  | { action: "cancel" };

export function decideSwipeRelease(input: {
  deltaX: number;
  velocityPxPerMs: number;
  width: number;
  commitDirections?: CommitDirections;
}): SwipeDecision {
  assertPositiveWidth(input.width);
  const direction = resolveCommitDirection(input);
  const allowed = input.commitDirections ?? "both";
  if (!direction || !isDirectionAllowed(direction, allowed)) {
    return { action: "cancel" };
  }
  return { action: "commit", direction };
}

/** Flick wins over distance; otherwise commit only past the width threshold. */
function resolveCommitDirection(input: {
  deltaX: number;
  velocityPxPerMs: number;
  width: number;
}): SwipeDirection | undefined {
  if (Math.abs(input.velocityPxPerMs) >= SWIPE_FLICK_PX_PER_MS) {
    return directionFromSign(input.velocityPxPerMs);
  }
  if (Math.abs(input.deltaX) >= input.width * SWIPE_COMMIT_RATIO) {
    return directionFromSign(input.deltaX);
  }
  return undefined;
}

function directionFromSign(value: number): SwipeDirection {
  return value < 0 ? "left" : "right";
}

function isDirectionAllowed(
  direction: SwipeDirection,
  allowed: CommitDirections,
): boolean {
  return allowed === "both" || direction === "right";
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

function swipeStageWidth(stage: HTMLElement): number {
  return Math.max(stage.offsetWidth, 1);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button, a, input") !== null;
}

function motionDurationMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

export interface WireSwipeOptions {
  commitDirections?: CommitDirections;
}

/**
 * Horizontal swipe on a stage. Work uses both directions to finish;
 * rest uses right-only to start the next set.
 * Tracks 1:1 while the pointer is down, then animates off-screen
 * (or snaps back) so the gesture is visible before advancing.
 */
export function wireSwipe(
  stage: HTMLElement,
  onCommit: () => void,
  options: WireSwipeOptions = {},
): void {
  const commitDirections = options.commitDirections ?? "both";
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
    const width = swipeStageWidth(stage);
    const fade = Math.min(1, Math.abs(x) / (width * 0.85));
    stage.style.opacity = String(1 - fade * 0.35);
  };

  const resetVisual = (): void => {
    stage.style.transform = "";
    stage.style.opacity = "";
    clearTransition();
    stage.classList.remove("is-swiping", "is-swipe-exit");
  };

  const afterMotion = (duration: number, then: () => void): void => {
    window.setTimeout(then, duration);
  };

  const animateTo = (
    transform: string,
    opacity: string,
    duration: number,
    easing: "ease-out" | "ease-in",
  ): void => {
    stage.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
    stage.style.transform = transform;
    stage.style.opacity = opacity;
  };

  const snapBack = (): void => {
    const duration = motionDurationMs(SWIPE_BACK_MS);
    animateTo("translateX(0)", "1", duration, "ease-out");
    afterMotion(duration, () => {
      resetVisual();
      settling = false;
    });
  };

  const exitAndCommit = (direction: SwipeDirection): void => {
    const duration = motionDurationMs(SWIPE_EXIT_MS);
    stage.classList.add("is-swipe-exit");
    animateTo(
      `translateX(${exitOffsetPx(swipeStageWidth(stage), direction)}px)`,
      "0",
      duration,
      "ease-in",
    );
    afterMotion(duration, () => {
      onCommit();
      // paint() replaces the stage; still clear in case commit is a no-op.
      resetVisual();
      settling = false;
    });
  };

  const settle = (decision: SwipeDecision): void => {
    settling = true;
    stage.classList.remove("is-swiping");
    if (decision.action === "cancel") {
      snapBack();
      return;
    }
    exitAndCommit(decision.direction);
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
    settle(
      decideSwipeRelease({
        deltaX,
        velocityPxPerMs: velocity,
        width: swipeStageWidth(stage),
        commitDirections,
      }),
    );
  };

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
}
