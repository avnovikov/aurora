import { describe, expect, it } from "vitest";
import {
  coldStartPreferLight,
  predictPreferLight,
  trainLightenForest,
  type LightenExample,
} from "../../src/pulse/lightenForest";

describe("lighten forest", () => {
  it("cold-starts toward light when sleep is poor or HR elevated", () => {
    expect(coldStartPreferLight({ sleep: 2, pain: 0, hr: 0 })).toBe(true);
    expect(coldStartPreferLight({ sleep: 0, pain: 0, hr: 1 })).toBe(true);
    expect(coldStartPreferLight({ sleep: 0, pain: 0, hr: 0 })).toBe(false);
  });

  it("learns to prefer light after elevated-HR accepts", () => {
    const examples: LightenExample[] = [
      { sleep: 0, pain: 0, hr: 2, label: 1, weight: 1 },
      { sleep: 0, pain: 0, hr: 2, label: 1, weight: 2 },
      { sleep: 0, pain: 0, hr: 0, label: 0, weight: 1 },
      { sleep: 0, pain: 0, hr: 0, label: 0, weight: 1 },
      { sleep: 1, pain: 0, hr: 1, label: 1, weight: 1 },
    ];
    const forest = trainLightenForest(examples, { seed: 7 });
    expect(predictPreferLight(forest, { sleep: 0, pain: 0, hr: 2 })).toBe(true);
    expect(predictPreferLight(forest, { sleep: 0, pain: 0, hr: 0 })).toBe(false);
  });
});
