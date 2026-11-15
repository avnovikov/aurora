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
