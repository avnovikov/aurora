import { describe, expect, it, vi } from "vitest";
import { scrollViewportToTop, type ScrollViewport } from "../../src/library/detailScroll";

describe("scrollViewportToTop", () => {
  it("scrolls the viewport to 0,0 so exercise detail always starts at the top", () => {
    const scrollTo = vi.fn();
    scrollViewportToTop({ scrollTo });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("rejects a viewport without scrollTo", () => {
    expect(() => scrollViewportToTop({} as ScrollViewport)).toThrow(/scrollTo/);
  });
});
