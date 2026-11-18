import { describe, expect, it } from "vitest";
import { dropIndex, edgeScroll, movedIndex } from "../../src/ui/dragReorder";
import { moveQueueItem } from "../../src/plan/queue";

const boxes = [0, 60, 120, 180].map((top) => ({ top, height: 60 }));

describe("drag a day to reorder", () => {
  it("lands where the pointer is, counted past the other days' middles", () => {
    expect(dropIndex(0, 10, boxes)).toBe(0);
    expect(dropIndex(0, 100, boxes)).toBe(1);
    expect(dropIndex(0, 239, boxes)).toBe(3);
    expect(dropIndex(3, -50, boxes)).toBe(0);
    expect(dropIndex(2, 140, boxes)).toBe(2);
  });

  it("shows the other days sliding exactly as the queue will move them", () => {
    const queue = ["a", "b", "c", "d"];
    for (let from = 0; from < 4; from += 1) {
      for (let to = 0; to < 4; to += 1) {
        const moved = moveQueueItem({ items: queue }, from, to).items;
        queue.forEach((id, index) => expect(moved[movedIndex(index, from, to)], `${from}->${to} ${id}`).toBe(id));
      }
    }
  });

  it("scrolls the page only while the finger is near the top or bottom edge", () => {
    expect(edgeScroll(10, 844)).toBeLessThan(0);
    expect(edgeScroll(400, 844)).toBe(0);
    expect(edgeScroll(830, 844)).toBeGreaterThan(0);
  });
});
