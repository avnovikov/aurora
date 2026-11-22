import { describe, expect, it } from "vitest";
import { CALISTENIAPP_MAP } from "../../src/data/import/calisteniappMap";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";

describe("Calisteniapp mapping (#291)", () => {
  it("points every mapped name at a real library move", () => {
    const missing = Object.entries(CALISTENIAPP_MAP).filter(([, m]) => m.id !== null && !EXERCISE_GRAPH[m.id]);
    expect(missing).toEqual([]);
  });

  it("maps hold names only to isometric moves", () => {
    const holds = ["Isometric squat", "Isometric wall squat", "Tucked front lever", "Fallen tucked front lever", "Isometric L sit on bar"];
    for (const name of holds) {
      expect(EXERCISE_GRAPH[CALISTENIAPP_MAP[name]!.id!]!.type, name).toBe("isometric");
    }
  });
});
