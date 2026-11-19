import { SEGMENTS } from "./rig";
import type { DoodleSpec, Face, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { along, FLOOR_PROP, round } from "./geom";

/**
 * Batch BL (#216): neck moves, drawn seated on a chair so the head reads.
 * Floor at y = 0, up is negative, the side-view figure faces +x. The head
 * faces by keyframe `face` (turn, tilt, nod).
 *
 * Seen sideways the figure's near side is its right (z < 0), the far side its left.
 */

// ---------------------------------------------------------------- the seated figure

const CHAIR: Prop = { kind: "box", x: -92, y: -84, w: 102, h: 84, frontHalf: 30 };
const PELVIS: Point = [-40, -90];
const CHEST: Point = [-40, -170];
const NECK: Point = [-40, -190];
const NECK_LEN = SEGMENTS.neckHead;

/** The head centre for a nod (+ chin down) with the neck continuing the spine. */
const headAt = (nod: number): Point => along(NECK, -90 + nod, NECK_LEN);

/** Seated on the chair, hands resting on the thighs unless `extra` says otherwise. */
function seated(extra: Partial<Pose> = {}): Pose {
  return {
    pelvis: PELVIS,
    chest: CHEST,
    hands: { near: [18, -96], far: [12, -96] },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [47, -2], far: [43, -2] },
    toes: { near: 0, far: 0 },
    ...extra,
  };
}

/** Both hands rest on the thighs. */
const rest = (): Pose => seated();

const keyframe = (pose: Pose, hold: number, face?: Face, sideways?: Sideways): Keyframe => ({ pose, hold, face, sideways });

// ---------------------------------------------------------------- chin to chest (hands behind the head)

/** The chin sinks `nod` degrees with the fingers laced behind the head and the elbows forward. */
function chinDown(nod: number): { pose: Pose; sideways: Sideways } {
  const head = headAt(nod);
  const face = along([0, 0], nod, 1);
  const up: Point = [face[1], -face[0]];
  // The back of the skull: behind the face and a touch up.
  const hand: Point = [round(head[0] - face[0] * 27 + up[0] * 8), round(head[1] - face[1] * 27 + up[1] * 8)];
  return {
    pose: seated({
      hands: { near: hand, far: [hand[0] + 2, hand[1]] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    }),
    sideways: { hands: { near: -5, far: 5 }, elbows: { near: { out: 44 }, far: { out: 44 } } },
  };
}

const chinFrame = (nod: number, hold: number): Keyframe => {
  const { pose, sideways } = chinDown(nod);
  return keyframe(pose, hold, { nod }, sideways);
};

const CHIN_TO_CHEST: Keyframe[] = [chinFrame(0, 0.5), chinFrame(55, 1.6), chinFrame(0, 0.4)];

// ---------------------------------------------------------------- front-on tilts and turns

/** The head centre when the neck tilts `tilt` degrees (+ towards the far side) in the front view: [x, y, z]. */
const tiltedHead = (tilt: number): readonly [number, number, number] => [
  NECK[0],
  round(NECK[1] - NECK_LEN * Math.cos((tilt * Math.PI) / 180)),
  round(NECK_LEN * Math.sin((tilt * Math.PI) / 180)),
];

/**
 * Tilting the ear to a shoulder with a hand on the head. `hand` is the working
 * arm; `across` puts its fingers on the far side of the head (the hand of the
 * other side's shoulder reaches over the top) rather than on the near side.
 */
function sideTilt(tilt: number, hand: Side, across: boolean, lift = 0): { pose: Pose; sideways: Sideways } {
  const [x, y, z] = tiltedHead(tilt);
  const toward = Math.sign(tilt);
  // The fingers lie on the crown, pulling over: just past the middle when reaching across.
  const hz = z + toward * (across ? -10 : 20);
  const tip: Point = [x - 2, round(y - 30 - lift)];
  const other: Side = hand === "near" ? "far" : "near";
  return {
    pose: seated({
      hands: { [hand]: tip, [other]: other === "near" ? [18, -96] : [12, -96] },
      elbows: { [hand]: { bend: 1 } },
    }),
    sideways: { hands: { [hand]: round(hz) }, elbows: { [hand]: { out: 85 } } },
  };
}

const tiltFrame = (tilt: number, hand: Side, across: boolean, hold: number, lift = 0): Keyframe => {
  const { pose, sideways } = sideTilt(tilt, hand, across, lift);
  return keyframe(pose, hold, { tilt }, sideways);
};
/** The hand rises over the head on the way in and out, before the head tips under it. */
const tiltIn = (tilt: number, hand: Side, across: boolean, hold: number): Keyframe[] => [
  tiltFrame(tilt * 0.3, hand, across, 0.05, 34),
  tiltFrame(tilt, hand, across, hold),
  tiltFrame(tilt * 0.3, hand, across, 0.05, 34),
];
const restFrame = (hold: number, face: Face = { tilt: 0 }): Keyframe => keyframe(rest(), hold, face);


// ---------------------------------------------------------------- isometric holds (hands on the head, the head stays put)

const HEAD0 = headAt(0);

/** A hand on the forehead, pressing forward: the elbow bent in front of the chest. */
function foreheadPress(): { pose: Pose; sideways: Sideways } {
  return {
    pose: seated({
      hands: { near: [round(HEAD0[0] + 28), round(HEAD0[1] - 10)], far: [12, -96] },
      elbows: { near: { bend: 1 } },
    }),
    sideways: { hands: { near: -4 }, elbows: { near: { out: 30 } } },
  };
}

/** Both hands laced behind the head, the elbows out, pressing back. */
function behindHead(): { pose: Pose; sideways: Sideways } {
  const hand: Point = [round(HEAD0[0] - 27), round(HEAD0[1] - 4)];
  return {
    pose: seated({ hands: { near: hand, far: [hand[0] + 2, hand[1]] }, elbows: { near: { bend: 1 }, far: { bend: 1 } } }),
    sideways: { hands: { near: -5, far: 5 }, elbows: { near: { out: 44 }, far: { out: 44 } } },
  };
}

/** One hand flat on the side of the head (`hand` near: the viewer's left), pressing the head into it. */
function sideHold(hand: Side): { pose: Pose; sideways: Sideways } {
  const z = hand === "near" ? -27 : 27;
  const other: Side = hand === "near" ? "far" : "near";
  return {
    pose: seated({
      hands: { [hand]: [round(HEAD0[0] - 2), round(HEAD0[1] - 6)], [other]: other === "near" ? [18, -96] : [12, -96] },
      elbows: { [hand]: { bend: 1 } },
    }),
    sideways: { hands: { [hand]: z }, elbows: { [hand]: { out: 85 } } },
  };
}

/** Between the thighs and behind the head the hands go out beside the shoulders, clear of the face. */
const handsOut = (): Keyframe =>
  keyframe(seated({ hands: { near: [-40, -196], far: [-38, -196] }, elbows: { near: { bend: 1 }, far: { bend: 1 } } }), 0.02, { turn: 0 }, { hands: { near: -52, far: 52 }, elbows: { near: { out: 80 }, far: { out: 80 } } });

const held = (part: { pose: Pose; sideways: Sideways }, hold: number): Keyframe => keyframe(part.pose, hold, { turn: 0 }, part.sideways);

// ---------------------------------------------------------------- chin tuck (side)

/** The head glides straight back over the neck with two fingers on the chin; the face stays level. */
function chinTuck(back: number): Pose {
  const head: Point = [round(HEAD0[0] - back), round(NECK[1] - Math.sqrt(NECK_LEN ** 2 - back ** 2))];
  return seated({
    head,
    hands: { near: [round(head[0] + 38), round(head[1] + 16)], far: [12, -96] },
    elbows: { near: { bend: 1 } },
  });
}

// ---------------------------------------------------------------- looking at the ceiling (kneeling backbend)

const KNEEL_FLOOR: Prop = FLOOR_PROP;
function kneel(lean: number, hips: number, hands: "thighs" | "heels"): Pose {
  const pelvis: Point = [hips, -88];
  const ankle: Point = [-52, -8];
  return {
    pelvis,
    chest: along(pelvis, -90 - lean, lean > 0 ? 77 : 80),
    spine: { bend: 1 },
    hands: hands === "heels" ? { near: [-52, -14], far: [-54, -14] } : { near: [hips + 10, -92], far: [hips + 6, -92] },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: ankle, far: [-62, -8] },
    toes: { near: 180, far: 180 },
  };
}

export const BATCH_BL_SPECS: DoodleSpec[] = [
  {
    id: "fedb_chin_to_chest_stretch",
    slug: "chin-to-chest-stretch",
    title: "Chin To Chest Stretch",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 1.1,
    frames: CHIN_TO_CHEST,
  },
  {
    id: "wger_1010",
    slug: "back-neck-stretch",
    title: "Back neck stretch",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 1.1,
    frames: CHIN_TO_CHEST,
  },
  {
    id: "fedb_side_neck_stretch",
    slug: "side-neck-stretch",
    title: "Side Neck Stretch",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 1.1,
    frames: [restFrame(0.5), ...tiltIn(-40, "near", false, 1.4), restFrame(0.5), ...tiltIn(40, "far", false, 1.4)],
  },
  {
    id: "wger_1008",
    slug: "left-neck-stretch",
    title: "Left neck stretch",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 1.1,
    frames: [restFrame(0.5), ...tiltIn(-40, "near", true, 1.6)],
  },
  {
    id: "wger_1009",
    slug: "right-neck-stretch",
    title: "Right neck stretch",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 1.1,
    frames: [restFrame(0.5), ...tiltIn(40, "far", true, 1.6)],
  },
  {
    id: "wger_1007",
    slug: "head-turns",
    title: "Head turns",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 0.9,
    frames: [restFrame(0.4, { turn: 0 }), restFrame(1, { turn: -80 }), restFrame(0.4, { turn: 0 }), restFrame(1, { turn: 80 })],
  },
  {
    id: "fedb_isometric_neck_exercise_front_and_back",
    slug: "isometric-neck-front-and-back",
    title: "Isometric Neck Exercise - Front And Back",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 0.8,
    frames: [restFrame(0.4, { turn: 0 }), held(foreheadPress(), 1.4), restFrame(0.4, { turn: 0 }), handsOut(), held(behindHead(), 1.4), handsOut()],
  },
  {
    id: "fedb_isometric_neck_exercise_sides",
    slug: "isometric-neck-sides",
    title: "Isometric Neck Exercise - Sides",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 0.8,
    frames: [restFrame(0.4, { turn: 0 }), held(sideHold("near"), 1.4), restFrame(0.4, { turn: 0 }), held(sideHold("far"), 1.4)],
  },
  {
    id: "wger_1006",
    slug: "chin-tuck",
    title: "Chin tuck",
    props: [CHAIR, FLOOR_PROP],
    transition: 0.9,
    frames: [
      { pose: chinTuck(0), hold: 0.6, face: { nod: 0 } },
      { pose: chinTuck(20), hold: 1.4, face: { nod: 5 } },
    ],
  },
  {
    id: "fedb_looking_at_ceiling",
    slug: "looking-at-ceiling",
    title: "Looking At Ceiling",
    props: [KNEEL_FLOOR],
    transition: 1,
    frames: [
      { pose: kneel(0, 10, "thighs"), hold: 0.5, face: { nod: 0 } },
      { pose: kneel(54, 34, "heels"), hold: 0.4, face: { nod: -10 } },
      { pose: kneel(54, 34, "heels"), hold: 1.4, face: { nod: -45 } },
    ],
  },
];
