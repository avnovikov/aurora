import { describe, expect, it } from "vitest";
import { EVALUATION_ARM_MS } from "../../src/ui/evaluationView";

describe("evaluation arming", () => {
  it("uses a short ghost-click window before accepting a pick", () => {
    expect(EVALUATION_ARM_MS).toBeGreaterThanOrEqual(300);
    expect(EVALUATION_ARM_MS).toBeLessThanOrEqual(600);
  });
});
