/**
 * Drill-down Back history (#219).
 *
 * Opening a screen from another screen pushes an entry that can re-show the
 * screen being left. Back (in-app button, swipe, or the phone's Back via
 * popstate) pops it. A bottom-bar tab tap clears the stack.
 *
 * Each push is mirrored into the browser history with its depth, so the
 * Android WebView's Back walks the same stack; popstate truncates to the
 * depth it lands on, which makes our own `history.back()` / `go()` no-ops.
 */

export interface NavEntry {
  /** Where Back goes, for the back button ("History", "list", …). */
  label: string;
  /** Re-show the screen that was left, with its state. */
  restore: () => void;
}

export interface HistoryLike {
  pushState(data: unknown, unused: string): void;
  back(): void;
  go(delta: number): void;
}

export interface Navigation {
  readonly depth: number;
  /** Remember the screen being left before opening another from it. */
  push(entry: NavEntry): void;
  /** Return to the previous screen; false when there is none. */
  back(): boolean;
  /** Forget the drill-down history (bottom-bar tab tap). */
  clear(): void;
  peek(): NavEntry | undefined;
  /** The phone's Back: `event.state` of a popstate. */
  handlePopState(state: unknown): void;
  /** Wire popstate on a window; returns a detach function. */
  listen(target: EventTarget): () => void;
}

const DEPTH_KEY = "auroraNavDepth";

function depthOf(state: unknown): number {
  if (typeof state === "object" && state !== null && DEPTH_KEY in state) {
    const depth = (state as Record<string, unknown>)[DEPTH_KEY];
    if (typeof depth === "number" && Number.isInteger(depth) && depth >= 0) {
      return depth;
    }
  }
  return 0;
}

export function createNavigation(history?: HistoryLike): Navigation {
  const stack: NavEntry[] = [];
  let restoring = false;

  const restore = (entry: NavEntry): void => {
    restoring = true;
    try {
      entry.restore();
    } finally {
      restoring = false;
    }
  };

  const nav: Navigation = {
    get depth() {
      return stack.length;
    },
    push(entry) {
      if (restoring) {
        return;
      }
      stack.push(entry);
      history?.pushState({ [DEPTH_KEY]: stack.length }, "");
    },
    back() {
      const entry = stack.pop();
      if (!entry) {
        return false;
      }
      restore(entry);
      history?.back();
      return true;
    },
    clear() {
      const pushed = stack.length;
      stack.length = 0;
      if (pushed > 0) {
        history?.go(-pushed);
      }
    },
    peek() {
      return stack[stack.length - 1];
    },
    handlePopState(state) {
      const depth = depthOf(state);
      if (depth >= stack.length) {
        return;
      }
      const entry = stack[depth]!;
      stack.length = depth;
      restore(entry);
    },
    listen(target) {
      const onPop = (event: Event): void => {
        nav.handlePopState((event as PopStateEvent).state);
      };
      target.addEventListener("popstate", onPop);
      return () => target.removeEventListener("popstate", onPop);
    },
  };
  return nav;
}
