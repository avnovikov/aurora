import { describe, expect, it, vi } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { GENERATED_DOODLES } from "../../src/data/generated/doodleMap";
import { FOCUS_BY_ID } from "../../src/doodles/focus";
import * as rig from "../../src/doodles/rig";
import { renderDoodleSvg } from "../../src/doodles/renderSvg";
import { DOODLE_SPECS } from "../../src/doodles/specs";
import { doodleMarkup } from "../../src/doodles/doodleMarkup";

/** Hex colours left after removing every `var(--name, #hex)` fallback. */
function bareHex(svg: string): string[] {
  return svg.replace(/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,8}\)/g, "").match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
}

const ids = (html: string): string[] => [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

const withInset = DOODLE_SPECS.filter((spec) => FOCUS_BY_ID[spec.id]?.zoom);
const jpgOnly = Object.values(EXERCISE_GRAPH).find(
  (exercise) => exercise.doodlePath?.endsWith(".jpg") && !GENERATED_DOODLES[exercise.id],
)!;

describe("palette-aware doodle SVG", () => {
  it("has no bare hex colours, only var(--doodle-…) fallbacks", () => {
    for (const spec of DOODLE_SPECS) {
      expect(bareHex(renderDoodleSvg(spec)), spec.slug).toEqual([]);
    }
  });

  it("names every colour role it uses", () => {
    const svg = renderDoodleSvg(withInset[0]);
    for (const role of ["ink", "paper", "focus", "backdrop"]) {
      expect(svg).toContain(`var(--doodle-${role},`);
    }
  });
});

describe("doodleMarkup", () => {
  it("inlines the animated svg for a spec id", () => {
    const html = doodleMarkup("glute_bridge", "Glute bridge");
    expect(html.startsWith("<svg")).toBe(true);
    expect(html).toContain('class="doodle"');
    expect(html).toContain('aria-label="Doodle for Glute bridge"');
    expect(html).toContain("<animate");
  });

  it("inlines the svg when given its generated path", () => {
    expect(doodleMarkup(GENERATED_DOODLES.hf_44, "Chin-up")).toBe(doodleMarkup("hf_44", "Chin-up"));
  });

  it("keeps an <img> for a hand-drawn (JPG-only) doodle", () => {
    const html = doodleMarkup(jpgOnly.id, jpgOnly.name);
    expect(html).toBe(`<img class="doodle" src="${jpgOnly.doodlePath}" alt="Doodle for ${jpgOnly.name}" />`);
    expect(doodleMarkup(jpgOnly.doodlePath, jpgOnly.name)).toBe(html);
  });

  it("returns nothing when there is no doodle", () => {
    expect(doodleMarkup(undefined, "Nothing")).toBe("");
    expect(doodleMarkup("no_such_exercise", "Nothing")).toBe("");
  });

  it("escapes the title", () => {
    expect(doodleMarkup("glute_bridge", `A "B" <C>`)).toContain('aria-label="Doodle for A &quot;B&quot; &lt;C&gt;"');
  });

  it("samples a spec's timeline once, then serves it from the cache", () => {
    const spy = vi.spyOn(rig, "sampleTimeline");
    const id = withInset[withInset.length - 1].id;
    const first = doodleMarkup(id, "One");
    const calls = spy.mock.calls.length;
    const second = doodleMarkup(id, "Two");
    expect(spy.mock.calls).toHaveLength(calls);
    expect(second.replace("Two", "One")).toBe(first);
    spy.mockRestore();
  });

  it("gives two doodles on one page no duplicate ids", () => {
    expect(withInset.length).toBeGreaterThan(1);
    const page = withInset.map((spec) => doodleMarkup(spec.id, spec.title)).join("");
    const all = ids(page);
    expect(all.length).toBeGreaterThan(1);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) {
      expect(page).toContain(`url(#${id})`);
    }
  });
});
