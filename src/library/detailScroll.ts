/**
 * Exercise detail always opens at the top of the page.
 * Chain links and re-paints reuse the screen, so the old scroll offset must not stick.
 */
export interface ScrollViewport {
  scrollTo(x: number, y: number): void;
}

export function scrollViewportToTop(viewport: ScrollViewport = window): void {
  if (typeof viewport.scrollTo !== "function") {
    throw new Error("viewport.scrollTo must be a function");
  }
  viewport.scrollTo(0, 0);
}
