import { describe, expect, it } from "vitest";
import { SEED_GRAPH } from "../../src/data/seed";
import { detailHtml } from "../../src/library/libraryDetail";
import { collectTemplateTargetIds } from "../../src/library/targets";

describe("detailHtml", () => {
  it("renders cues, pattern, and progression links for pull-up", () => {
    const exercise = SEED_GRAPH.pullup;
    const targets = collectTemplateTargetIds();
    const html = detailHtml(exercise, targets, SEED_GRAPH);
    expect(html).toContain("Pull-up");
    expect(html).toContain("vertical pull");
    expect(html).toContain('data-lib-back');
    expect(html).toContain("Target");
    expect(html).toContain("data-chain-id=");
    expect(html).toContain("Your level");
    expect(html).toContain("data-skill-tier");
    expect(html).toContain("Standards");
  });

  it("omits target badge for non-target warm-ups", () => {
    const exercise = SEED_GRAPH.pulse_raiser_march;
    const targets = collectTemplateTargetIds();
    const html = detailHtml(exercise, targets, SEED_GRAPH);
    expect(html).not.toContain("lib-badge");
  });
});