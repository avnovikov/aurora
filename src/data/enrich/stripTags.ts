/** Remove HTML tags without a backtracking regex. */
export function stripTags(html: string): string {
  let out = "";
  let inTag = false;
  for (const char of html) {
    if (char === "<") {
      inTag = true;
      out += " ";
    } else if (char === ">") {
      inTag = false;
    } else if (!inTag) {
      out += char;
    }
  }
  return out;
}

/**
 * Named entities that show up in imported exercise text.
 * `&amp;` stays last so `&amp;lt;` becomes `&lt;`, not `<`.
 */
const HTML_ENTITIES: readonly [entity: string, character: string][] = [
  ["&nbsp;", " "],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&amp;", "&"],
];

/** Decode the handful of HTML entities that occur in imported exercise text. */
export function decodeEntities(text: string): string {
  let decoded = text;
  for (const [entity, character] of HTML_ENTITIES) {
    decoded = decoded.replaceAll(entity, character);
  }
  return decoded;
}
