import { describe, expect, it } from "vitest";
import { decodeEntities, stripTags } from "../../src/data/enrich/stripTags";

describe("stripTags", () => {
  it("replaces each tag with a single space", () => {
    expect(stripTags("a<b>c</b>d")).toBe("a c d");
  });
});

describe("decodeEntities", () => {
  it("decodes the named entities used in catalogue text", () => {
    expect(decodeEntities("&quot;hi&#39; &nbsp; there&quot;")).toBe("\"hi'   there\"");
    expect(decodeEntities("&lt;tag&gt;")).toBe("<tag>");
  });

  it("leaves &amp;lt; as the text &lt; instead of a real bracket", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
    expect(decodeEntities("&amp;gt;")).toBe("&gt;");
    expect(decodeEntities("&amp;amp;")).toBe("&amp;");
  });
});
