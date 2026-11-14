import { describe, expect, it } from "vitest";
import {
  PRODUCT_NAME,
  SOUL_NAME,
  aboutBlurb,
  productTitleLine,
} from "../../src/brand/identity";

describe("brand identity", () => {
  it("uses Aurora as product name and Rassvet as soul mark", () => {
    expect(PRODUCT_NAME).toBe("Aurora");
    expect(SOUL_NAME).toBe("Rassvet");
    expect(productTitleLine()).toBe("Aurora · Rassvet");
  });

  it("mentions both names in the about blurb", () => {
    const blurb = aboutBlurb();
    expect(blurb).toContain("Aurora");
    expect(blurb).toContain("Rassvet");
  });
});
