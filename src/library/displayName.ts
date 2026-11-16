/**
 * Proper nouns found in Library exercise names (people, places, peoples,
 * characters). They keep their capital when a name is shown in sentence case.
 */
export const PROPER_NOUNS: ReadonlySet<string> = new Set([
  "Achilles",
  "Arnold",
  "Aztec",
  "Bulgarian",
  "Copenhagen",
  "Cossack",
  "German",
  "Gironda",
  "Hindu",
  "Janda",
  "Japanese",
  "Jefferson",
  "Korean",
  "Maltese",
  "Nordic",
  "Romanian",
  "Russian",
  "Spiderman",
  "Superman",
  "Turkish",
  "Tyson",
  "Victorian",
]);

const WORD = /[A-Za-z]+/g;

/** One capital standing for a body shape: the L in L-sit, each letter of Y-T-W. */
function isLetterShape(word: string): boolean {
  return /^[A-Z]$/.test(word);
}

/** Two or more capitals mark an abbreviation: TRX, IT, IR, CARs. */
function isAbbreviation(word: string): boolean {
  return (word.match(/[A-Z]/g) ?? []).length >= 2;
}

function keepsItsCase(word: string): boolean {
  return PROPER_NOUNS.has(word) || isLetterShape(word) || isAbbreviation(word);
}

/**
 * An exercise name as the screen shows it: sentence case, with proper nouns,
 * letter shapes and abbreviations kept as written. "Bulgarian Split Squat"
 * reads "Bulgarian split squat"; "L-Sit Pull-Up" reads "L-sit pull-up".
 * Display only: stored names, ids and planner input stay as they are.
 */
export function displayExerciseName(name: string): string {
  const known = shown.get(name);
  if (known !== undefined) {
    return known;
  }
  const lowered = name.replace(WORD, (word) => (keepsItsCase(word) ? word : word.toLowerCase()));
  const result = lowered.charAt(0).toUpperCase() + lowered.slice(1);
  shown.set(name, result);
  return result;
}

/** Names already cased; the Library is finite, and the session repaints the same few. */
const shown = new Map<string, string>();

/** The display name for an exercise id, or the id itself (uncased) when the graph lacks it. */
export function displayNameOf(
  exerciseId: string,
  graph: Readonly<Record<string, { name: string } | undefined>>,
): string {
  const name = graph[exerciseId]?.name;
  return name === undefined ? exerciseId : displayExerciseName(name);
}
