import { describe, expect, it } from "vitest";
import { planPickHtml } from "../../src/library/libraryPlanPick";

describe("planPickHtml", () => {
  it("defaults the tomorrow radio and labels it", () => {
    const html = planPickHtml("Wall handstand", [
      {
        index: 0,
        templateId: "tmpl_legs",
        name: "Legs",
        isDefault: false,
      },
      {
        index: 1,
        templateId: "tmpl_skill_hs",
        name: "Skill",
        isDefault: true,
      },
    ]);
    expect(html).toContain('value="tmpl_skill_hs" checked');
    expect(html).toContain("Skill (tomorrow)");
    expect(html).toContain("Add to plan");
  });
});
