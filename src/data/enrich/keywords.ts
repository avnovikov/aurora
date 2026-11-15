/** Lower-case, punctuation → spaces, padded so " dip" means "word starting with dip". */
export function normaliseForKeywords(name: string): string {
  return ` ${name.toLowerCase().replaceAll(/[^a-z0-9&/]+/g, " ").trim()} `;
}

/** True when any keyword occurs in the normalised name (keywords are lower-case). */
export function hasKeyword(name: string, keywords: readonly string[]): boolean {
  const haystack = normaliseForKeywords(name);
  return keywords.some((keyword) => haystack.includes(keyword));
}
