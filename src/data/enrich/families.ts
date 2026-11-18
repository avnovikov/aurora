import type { Difficulty } from "../../domain/types";

/**
 * Movement families as ordered ladders. Each rung has a rank (easy → hard)
 * and the difficulty tier of a move on that rung. Rungs are *matched* in the
 * listed order (specific keywords first); `rank` decides the progression.
 *
 * Keywords match a normalised name: lower-case, punctuation → spaces, padded
 * with a leading/trailing space (see enrich/keywords.ts).
 *
 * Evidence (full list: docs/superpowers/specs/2026-11-15-library-levels-evidence.md):
 *  push_up   Wurm & Ebben 2011 JSCR (force-plate % body mass: high incline <
 *            knee < low incline < standard < feet-elevated); Ludewig 2004 AJSM
 *            PMID 14977678 (wall / push-up plus).
 *  pull      Youdas 2010 JSCR PMID 21068680 (pull-up ≈ chin-up); Fenwick 2009
 *            JSCR (inverted row); Prinold & Bull 2016 PMID 26383875.
 *  dip       McKenzie 2022 IJERPH doi:10.3390/ijerph192013211 (bench < bar < ring).
 *  glute     DiStefano 2009 JOSPT doi:10.2519/jospt.2009.2796; Reiman 2012
 *            doi:10.3109/09593985.2011.604981; Boren 2011 PMID 22034614;
 *            Contreras 2015 PMID 26214739 (hip thrust).
 *  hamstring Petersen 2011 PMID 21825112; van Dyk 2019 BJSM; Bourne 2017 BJSM.
 *  adductor  Serner 2014 BJSM; Ishøi 2016 PMID 26589483; Harøy 2019 BJSM.
 *  core      Kavcic 2004 PMID 15480148; Ekstrom 2007 JOSPT; Escamilla 2006
 *            PMID 16649890 & 2010 PMID 20436242; Calatayud 2017 AJPMR.
 *  scapular  Ekstrom 2003 PMID 12774999; Cools 2007 AJSM; Ludewig 2004.
 *  calf      Baxter 2021 MSSE PMID 32658037 (seated < double < single leg).
 *  plyo      NSCA position statement 1993 (landing → jump → box → depth).
 *  Squat, handstand, lever, planche and muscle-up ladders follow coaching
 *  convention (no comparative load studies found) — ordered by lever length.
 */
export interface Rung {
  rank: number;
  tier: Difficulty;
  keywords: readonly string[];
}

export interface Family {
  id: string;
  includes: readonly string[];
  excludes?: readonly string[];
  rungs: readonly Rung[];
  /** Rung for members that match no rung keyword. */
  fallback: Omit<Rung, "keywords">;
  /** Next step after this family's hardest rung (another family's member). */
  harderTo?: CrossLink;
  /** Step before this family's easiest rung. */
  easierFrom?: CrossLink;
}

/** Points at members of another family: by rank, by name keyword, or both. */
export interface CrossLink {
  family: string;
  rank?: number;
  keyword?: string;
}

const r = (rank: number, tier: Rung["tier"], keywords: readonly string[]): Rung => ({
  rank,
  tier,
  keywords,
});

/** Matched in this order: a move joins the first family that includes it. */
export const FAMILIES: readonly Family[] = [
  {
    id: "scapular",
    includes: [
      "scapula push", "scapular push", "scap push", "push up plus", "wall slide", "wall angel",
      "serratus", " y raise", "ytw", "y t w", " w raise", "trap 3", "snow angel", "retraction",
      "skydiver",
    ],
    rungs: [
      r(3, "beginner", ["push up plus"]),
      r(2, "beginner", ["scapula push", "scapular push", "scap push"]),
      r(0, "beginner", ["wall slide", "wall angel", "serratus"]),
    ],
    fallback: { rank: 1, tier: "beginner" },
  },
  {
    id: "planche",
    includes: ["planche", "maltese push"],
    excludes: ["pseudo"],
    rungs: [
      r(3, "elite", ["full planche", "planche push", "straddle planche", "maltese"]),
      r(2, "advanced", ["tuck planche", "dynamic planche"]),
      r(1, "intermediate", ["planche lean"]),
    ],
    fallback: { rank: 2, tier: "advanced" },
    easierFrom: { family: "push_up", keyword: "standard push" },
  },
  {
    id: "front_lever",
    includes: ["front lever"],
    rungs: [
      r(2, "elite", ["full front lever", "front lever row", "front lever pull"]),
      r(1, "advanced", ["tuck front lever", "front lever tuck"]),
    ],
    fallback: { rank: 2, tier: "elite" },
    easierFrom: { family: "pull", rank: 3 },
  },
  {
    id: "back_lever",
    includes: ["back lever", "skin the cat"],
    rungs: [
      r(1, "advanced", ["tuck back lever"]),
      r(0, "intermediate", ["skin the cat"]),
    ],
    fallback: { rank: 2, tier: "advanced" },
  },
  {
    id: "rings_cross",
    includes: [" iron cross", "victorian", "maltese cross"],
    excludes: ["bent knee", "stretch"],
    rungs: [],
    fallback: { rank: 0, tier: "elite" },
  },
  {
    id: "overhead_push",
    includes: ["handstand push", " hspu", "pike push", "pike hold", "elevated pike", "tiger bend"],
    rungs: [
      r(4, "elite", ["freestanding handstand push", "90 degree", "tiger bend"]),
      r(3, "elite", ["deficit handstand"]),
      r(1, "intermediate", ["elevated pike", "box handstand"]),
      r(2, "advanced", ["wall handstand push", "handstand push"]),
      r(0, "intermediate", ["pike push"]),
      r(-1, "beginner", ["pike hold"]),
    ],
    fallback: { rank: 2, tier: "advanced" },
    easierFrom: { family: "push_up", keyword: "standard push" },
  },
  {
    id: "balance",
    includes: ["handstand", "crow", "frog stand", "elbow lever", "straight arm press"],
    rungs: [
      r(3, "elite", ["press to handstand", "straight arm press", "japanese"]),
      r(2, "advanced", ["freestanding", "handstand hold", "handstand attempt", "chest to wall"]),
      r(1, "intermediate", ["wall handstand"]),
      r(0, "intermediate", ["crow", "frog stand", "elbow lever"]),
    ],
    fallback: { rank: 2, tier: "advanced" },
  },
  {
    id: "pull",
    includes: [
      " pull up", "pullup", " chin", "muscle up", " hang ", "scapular pull", "scapula pull",
      "recruitment pull", "deadhang",
    ],
    excludes: ["front lever", "leg raise", "knee raise", "toes to bar", "german hang", "chin tuck", "chin to chest"],
    rungs: [
      r(6, "elite", ["one arm pull", "one arm chin", "ring muscle"]),
      r(4, "elite", [
        "kipping muscle", "archer", "typewriter", "l sit pull", "side to side", "explosive pull",
        "towel pull", "headbanger", "one handed hang", "sternum",
      ]),
      r(5, "elite", ["muscle up"]),
      r(2, "intermediate", [
        "jumping pull", "negative", "eccentric", "isometric hold", "top position",
      ]),
      r(1, "beginner", ["scapular pull", "scapula pull", "arch hang", "recruitment"]),
      r(0, "beginner", ["dead hang", "active hang", "deadhang", " hang "]),
    ],
    fallback: { rank: 3, tier: "advanced" },
  },
  {
    id: "row",
    includes: [" row", "australian", "horizontal traction", "face pull"],
    rungs: [
      r(3, "advanced", ["one arm inverted", "one arm row"]),
      r(2, "intermediate", ["wide grip inverted", "feet elevated"]),
      r(0, "beginner", ["trx", "rings", "ring row", "incline row", "suspended row", "mid row", "face pull", "traction"]),
    ],
    fallback: { rank: 1, tier: "intermediate" },
    harderTo: { family: "pull", rank: 3 },
  },
  {
    id: "dip",
    includes: [" dip", " support ", "bar hold"],
    excludes: ["hip dip"],
    rungs: [
      r(4, "elite", ["ring dip", "straight bar dip", "korean", "l sit dip", "plyo dip"]),
      r(2, "intermediate", ["ring support"]),
      r(0, "beginner", ["floor dip", "chair dip", "bench dip", "between two benches"]),
      r(1, "intermediate", ["support", "bar hold"]),
    ],
    fallback: { rank: 3, tier: "advanced" },
  },
  {
    id: "push_up",
    includes: [" push up", "pushup", " press up"],
    excludes: ["handstand", "pike"],
    rungs: [
      r(7, "elite", ["one arm", "single arm", "superman push", "maltese push"]),
      r(6, "advanced", [
        "archer", "typewriter", "pseudo planche", "clap", "plyo", "explosive", "aztec", "russian",
        "tyson", "finger",
      ]),
      r(5, "intermediate", ["decline", "feet elevated", "deficit", "dive bomber", "hindu", "sphinx"]),
      r(3, "beginner", ["low incline"]),
      r(2, "beginner", ["knee"]),
      r(1, "beginner", ["incline"]),
      r(0, "beginner", ["wall"]),
    ],
    fallback: { rank: 4, tier: "intermediate" },
  },
  {
    id: "squat_single",
    includes: [
      "split squat", "bulgarian", "lunge", " step up", "pistol", "shrimp", "skater squat",
      "dragon squat", "cossack", "sissy", "1 leg box", "single leg squat", "archer squat", "curtsy",
      "step down",
    ],
    excludes: ["jump", "stretch"],
    rungs: [
      r(5, "elite", ["dragon squat"]),
      // Holding a support, partial depth: same step as a 1-leg box squat but easier.
      r(3, "intermediate", ["assisted pistol"]),
      r(4, "advanced", ["pistol"]),
      r(3, "advanced", ["skater", "shrimp", "1 leg box", "archer squat", "sissy", "single leg squat"]),
      r(2, "intermediate", ["bulgarian", "deficit", "knee drive", "cossack", "step down"]),
      r(0, "beginner", ["supported split"]),
    ],
    fallback: { rank: 1, tier: "intermediate" },
    easierFrom: { family: "squat", rank: 1 },
  },
  {
    id: "squat",
    includes: ["squat", "wall sit"],
    excludes: ["thrust", "jack", "jump", "stretch", "deep squat hold"],
    rungs: [
      r(0, "beginner", ["box squat", "sit squat"]),
      r(2, "beginner", ["wall sit", "wall squat", "isometric squat", "slow", "pulse", "prisoner", "hindu", "sumo"]),
    ],
    fallback: { rank: 1, tier: "beginner" },
    harderTo: { family: "squat_single", rank: 0 },
  },
  {
    id: "hamstring",
    includes: [
      "nordic", "hamstring curl", "leg curl", "glute ham", " rdl ", "romanian", "good morning",
      "hyperextension", "reverse hyper", "hip hinge",
    ],
    excludes: ["reverse nordic", "pancake"],
    rungs: [
      r(3, "advanced", ["nordic", "glute ham"]),
      r(2, "intermediate", ["sliding", "leg curl", "hamstring curl", "glider"]),
      r(1, "beginner", [" rdl ", "romanian"]),
    ],
    fallback: { rank: 0, tier: "beginner" },
  },
  {
    id: "glute",
    includes: [
      "bridge", "hip thrust", "clam", "hydrant", "abduction", "kickback", "donkey kick", "frog pump",
      "butt lift", "arabesque", "lateral walk", "side leg raise", "side lying hip",
    ],
    excludes: ["back bridge", "neck bridge", "side bridge", "seated"],
    rungs: [
      r(4, "intermediate", ["hip thrust"]),
      r(3, "beginner", [
        "single leg glute", "single leg bridge", "bridge march", "walking bridge", "kickback",
        "donkey", "arabesque",
      ]),
      r(0, "beginner", ["clam"]),
      r(1, "beginner", ["abduction", "side leg raise", "side lying hip", "hydrant", "lateral walk"]),
    ],
    fallback: { rank: 2, tier: "beginner" },
  },
  {
    id: "adductor",
    includes: ["copenhagen", "adduction exercise"],
    rungs: [],
    fallback: { rank: 0, tier: "intermediate" },
  },
  {
    id: "calf",
    includes: ["calf raise", "tibialis", "heel raise"],
    rungs: [
      r(2, "beginner", ["single leg", "one legged"]),
      r(0, "beginner", ["seated", "sitting"]),
    ],
    fallback: { rank: 1, tier: "beginner" },
  },
  {
    id: "side_plank",
    includes: ["side plank"],
    rungs: [r(1, "intermediate", ["hip lift", "rotation", "dynamic", "reach"])],
    fallback: { rank: 0, tier: "beginner" },
  },
  {
    id: "anti_extension",
    includes: [
      "plank", "dead bug", "deadbug", "bird dog", "hollow", "ab wheel", "rollout", "roll out",
      "body saw", "dragon flag", "leg wheel",
    ],
    excludes: ["jack", "side plank", "push up"],
    rungs: [
      r(4, "elite", ["dragon flag"]),
      r(3, "advanced", ["body saw", "rollout", "roll out", "ab wheel", "leg wheel"]),
      r(2, "intermediate", [
        "hollow rock", "hollow body rock", "plank up", "plank reach", "alternating leg", "shoulder tap", "spiderman",
        "plank to", "plank walk", "hip dip", "alternate floor",
      ]),
      r(0, "beginner", ["dead bug", "deadbug", "bird dog", "bear plank", "cat plank"]),
      r(1, "beginner", ["hollow", "plank"]),
    ],
    fallback: { rank: 1, tier: "beginner" },
  },
  {
    id: "compression",
    includes: [
      "leg raise", "knee raise", "knee tuck", "toes to bar", " l sit", " l hold", " v sit", "manna",
      "pike compression", "hanging pike", "leg tuck", "leg pull in", "hip raise on", "windshield",
    ],
    excludes: ["side leg raise", "rear leg raise", "front leg raise", "straight leg raise", "jump"],
    rungs: [
      r(5, "elite", ["manna"]),
      r(4, "advanced", ["toes to bar", "straddle l", " v sit", "pike compression"]),
      r(2, "intermediate", ["floor windshield"]),
      r(3, "advanced", ["hanging leg raise", "hanging pike", "hip lift on rings", "windshield"]),
      r(2, "intermediate", ["tuck l sit", "foot supported"]),
      r(3, "advanced", [" l sit", " l hold"]),
      r(1, "intermediate", ["knee raise", "hip raise on"]),
    ],
    fallback: { rank: 0, tier: "beginner" },
  },
  {
    id: "flexion",
    includes: [
      "crunch", " sit up", "situp", " v up", "vup", "jackknife", "sit outs", "toe touchers",
      "heel touch", "butterfly sit",
    ],
    rungs: [
      r(2, "intermediate", [" v up", "vup", "jackknife", "roll overs"]),
      r(1, "beginner", [" sit up", "situp", "sit outs", "toe touchers", "butterfly sit"]),
    ],
    fallback: { rank: 0, tier: "beginner" },
    harderTo: { family: "compression", keyword: "hanging leg" },
  },
  {
    id: "plyo",
    includes: [" jump", " hop", " hops", "bound", "snap down", "landing", "jumps"],
    excludes: ["rope", "jack"],
    rungs: [
      r(4, "advanced", ["depth"]),
      r(3, "intermediate", ["box jump", "bench jump"]),
      r(2, "intermediate", ["tuck", "lunge jump", "split jump", "broad", "long jump", "bound", "frog", "rocket"]),
      r(0, "beginner", ["snap down", "landing"]),
    ],
    fallback: { rank: 1, tier: "beginner" },
  },
  {
    id: "human_flag",
    includes: ["human flag"],
    rungs: [],
    fallback: { rank: 0, tier: "elite" },
  },
];
