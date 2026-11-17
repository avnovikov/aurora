import { scrollViewportToTop, type ScrollViewport } from "../library/detailScroll";

/** Top of the viewport when switching main tabs (#124). */
export function resetTabScroll(viewport: ScrollViewport = window): void {
  scrollViewportToTop(viewport);
}
