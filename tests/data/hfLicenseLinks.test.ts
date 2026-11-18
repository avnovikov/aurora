import { describe, expect, it } from "vitest";
import { filterAllowedHfMediaLinks, isAllowedHfMediaLink } from "../../src/data/hf/licenseLinks";
import type { HfLink } from "../../src/data/hf/types";

function link(partial: Partial<HfLink> & Pick<HfLink, "source" | "type" | "url">): HfLink {
  return {
    license: null,
    ...partial,
  };
}

describe("isAllowedHfMediaLink", () => {
  it("accepts CC-BY-SA-3.0 images from everkinetic", () => {
    const item = link({
      source: "everkinetic",
      type: "image",
      url: "http://example.com/a.jpg",
      license: "CC-BY-SA-3.0",
    });
    expect(isAllowedHfMediaLink(item)).toBe(true);
  });

  it("rejects null licenses and bare pages", () => {
    expect(
      isAllowedHfMediaLink(
        link({ source: "wger.de", type: "page", url: "https://wger.de/x", license: null }),
      ),
    ).toBe(false);
  });

  it("rejects free-exercise-db even when tagged public-domain", () => {
    const item = link({
      source: "free-exercise-db",
      type: "image",
      url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/x.jpg",
      license: "public-domain",
    });
    expect(isAllowedHfMediaLink(item)).toBe(false);
    expect(filterAllowedHfMediaLinks([item])).toEqual([]);
  });

  it("rejects MuscleWiki bare page links", () => {
    const item = link({
      source: "musclewiki.com",
      type: "page",
      url: "https://musclewiki.com/exercise/push-up",
      license: "CC-BY-SA-3.0",
    });
    expect(isAllowedHfMediaLink(item)).toBe(false);
  });
});