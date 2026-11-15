import { describe, expect, it } from "vitest";
import type { ChainMap } from "../../src/progress/chainMap";
import { compactProgressBlock } from "../../src/progress/compactProgress";

function chain(partial: Partial<ChainMap> & Pick<ChainMap, "nodes" | "currentId">): ChainMap {
  return {
    rootId: "bodyweight_squat",
    label: "Squat",
    status: { kind: "hold", reason: "Hold" },
    ...partial,
  };
}

describe("compactProgressBlock", () => {
  it("keeps only current and the immediate harder step", () => {
    const block = compactProgressBlock(
      chain({
        currentId: "bulgarian_split",
        nodes: [
          { id: "bodyweight_squat", name: "Bodyweight squat", position: "easier" },
          { id: "bulgarian_split", name: "Bulgarian split squat", position: "current" },
          { id: "pistol_squat", name: "Pistol squat", position: "harder" },
        ],
      }),
    );
    expect(block.current.name).toBe("Bulgarian split squat");
    expect(block.next?.name).toBe("Pistol squat");
  });

  it("returns null next at the top of the chain", () => {
    const block = compactProgressBlock(
      chain({
        currentId: "pistol_squat",
        nodes: [
          { id: "bodyweight_squat", name: "Bodyweight squat", position: "easier" },
          { id: "pistol_squat", name: "Pistol squat", position: "current" },
        ],
      }),
    );
    expect(block.current.id).toBe("pistol_squat");
    expect(block.next).toBeNull();
  });
});
