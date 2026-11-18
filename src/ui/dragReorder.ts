/** Vertical position and height of one list item, in viewport pixels. */
export interface ItemBox {
  top: number;
  height: number;
}

/**
 * Where a dragged item lands: how many of the other items have their middle
 * above the pointer. That is the item's index in the list after the move.
 */
export function dropIndex(from: number, pointerY: number, boxes: readonly ItemBox[]): number {
  return boxes.filter((box, index) => index !== from && box.top + box.height / 2 < pointerY).length;
}

/** Where the item now at `index` ends up after moving one item from `from` to `to`. */
export function movedIndex(index: number, from: number, to: number): number {
  if (index === from) {
    return to;
  }
  if (from < index && index <= to) {
    return index - 1;
  }
  if (to <= index && index < from) {
    return index + 1;
  }
  return index;
}

const DRAGGING = "is-dragging";
/** Within this many pixels of the screen edge, a drag scrolls the page. */
const EDGE = 64;
const SCROLL_STEP = 14;

/** How far to scroll the page for a pointer this close to the top or bottom edge. */
export function edgeScroll(pointerY: number, viewportHeight: number): number {
  if (pointerY < EDGE) {
    return -SCROLL_STEP;
  }
  return pointerY > viewportHeight - EDGE ? SCROLL_STEP : 0;
}

/**
 * Lets a finger (or mouse) drag the items of `list` by their `[data-drag-handle]`.
 * The dragged item follows the pointer and the others slide to show where it
 * will land; on release `onDrop(from, to)` is called when the position changed.
 * Items are the list's direct children, in order.
 */
export function enableDragReorder(list: HTMLElement, onDrop: (from: number, to: number) => void): void {
  const items = (): HTMLElement[] => Array.from(list.children) as HTMLElement[];

  list.querySelectorAll<HTMLElement>("[data-drag-handle]").forEach((handle) => {
    handle.addEventListener("pointerdown", (down) => {
      const item = handle.closest<HTMLElement>(":scope > *") ?? handle.parentElement!;
      const all = items();
      const from = all.indexOf(item);
      if (from < 0) {
        return;
      }
      down.preventDefault();
      handle.setPointerCapture(down.pointerId);
      const boxes = all.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      });
      const shift = boxes[from]!.height;
      const startScroll = window.scrollY;
      let to = from;
      let lastY = down.clientY;
      item.classList.add(DRAGGING);

      const layout = (): void => {
        // Boxes were measured before any scroll; compare in that frame.
        const pointerY = lastY + window.scrollY - startScroll;
        item.style.transform = `translateY(${pointerY - down.clientY}px)`;
        to = dropIndex(from, pointerY, boxes);
        all.forEach((other, index) => {
          if (index === from) {
            return;
          }
          const offset = movedIndex(index, from, to) - index;
          other.style.transform = offset === 0 ? "" : `translateY(${offset * shift}px)`;
        });
      };
      let scrolling = 0;
      const autoScroll = (): void => {
        const step = edgeScroll(lastY, window.innerHeight);
        if (step !== 0) {
          window.scrollBy(0, step);
          layout();
        }
        scrolling = step === 0 ? 0 : requestAnimationFrame(autoScroll);
      };
      const move = (event: PointerEvent): void => {
        lastY = event.clientY;
        layout();
        if (scrolling === 0) {
          scrolling = requestAnimationFrame(autoScroll);
        }
      };
      const end = (): void => {
        cancelAnimationFrame(scrolling);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        item.classList.remove(DRAGGING);
        all.forEach((element) => {
          element.style.transform = "";
        });
        if (to !== from) {
          onDrop(from, to);
        }
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    });
  });
}
