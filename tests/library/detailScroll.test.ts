import { describe, expect, it, vi } from "vitest";
import {
  readScrollY,
  restoreScrollY,
  scrollViewportToTop,
  shouldScrollDetailToTop,
  type ScrollViewport,
} from "../../src/library/detailScroll";

describe("shouldScrollDetailToTop", () => {
  it("scrolls when opening the first exercise or a different one", () => {
    expect(shouldScrollDetailToTop(null, "pullup")).toBe(true);
    expect(shouldScrollDetailToTop("dip", "pullup")).toBe(true);
  });

  it("keeps scroll when the same exercise re-paints", () => {
    expect(shouldScrollDetailToTop("pullup", "pullup")).toBe(false);
  });
});

describe("scrollViewportToTop", () => {
  it("scrolls the viewport to 0,0 so a new exercise starts at the top", () => {
    const scrollTo = vi.fn();
    scrollViewportToTop({ scrollTo });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("rejects a viewport without scrollTo", () => {
    expect(() => scrollViewportToTop({} as ScrollViewport)).toThrow(/scrollTo/);
  });
});

describe("list scroll restore", () => {
  it("reads and restores the list scroll offset", () => {
    const scrollTo = vi.fn();
    expect(readScrollY({ scrollTo, scrollY: 420 })).toBe(420);
    restoreScrollY(420, { scrollTo });
    expect(scrollTo).toHaveBeenCalledWith(0, 420);
  });
});
