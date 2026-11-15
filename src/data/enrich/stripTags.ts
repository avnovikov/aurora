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

/** Decode the handful of HTML entities that occur in imported exercise text. */
export function decodeEntities(text: string): string {
  return text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
