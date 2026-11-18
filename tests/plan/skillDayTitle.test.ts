import { describe, expect, it } from "vitest";
import type { SessionTemplate } from "../../src/domain/program";
import { dayTitle, skillTitle, storedSkillTitle } from "../../src/plan/dayKinds";

describe("skill day titles", () => {
  it("saves the library name and shows it in sentence case", () => {
    expect(storedSkillTitle("hf_2")).toBe("Skill: Standard Push-Up");
    expect(skillTitle("hf_2")).toBe("Skill: Standard push-up");
  });

  it("shows a saved generated skill day in sentence case, whatever its stored name", () => {
    const day = {
      name: "Skill: Standard Push-Up · B",
      kind: "skill",
      block: { id: "blk_x", letter: "B", emphasis: "strength" },
      targetExerciseIds: ["hf_2"],
    } as unknown as SessionTemplate;
    expect(dayTitle(day)).toBe("Skill: Standard push-up · B");
  });
});
