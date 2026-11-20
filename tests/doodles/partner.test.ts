import { describe, expect, it } from "vitest";
import { holdSlips, jointOf, partner3D, partnerFlat, partnerSpec, PARTNER_OPACITY, PARTNER_WIDTH } from "../../src/doodles/partner";
import { dualLayout } from "../../src/doodles/renderDual";
import { figurePoints, renderDoodleSvg, specViewBox } from "../../src/doodles/renderSvg";
import { dist, sampleTimeline, type DoodleSpec, type Point, type Pose } from "../../src/doodles/rig";
import { sampleTimeline3 } from "../../src/doodles/rig3d";
import { partnerGuards, validateSpec } from "../../src/doodles/validate";

const HIP: Point = [0, -22];
const along = (from: Point, deg: number, length: number): Point => {
  const r = (deg * Math.PI) / 180;
  return [from[0] + Math.cos(r) * length, from[1] + Math.sin(r) * length];
};

/** Lying face up, the near leg raised straight at `deg`, hands on the floor by the hips. */
const lying = (deg: number): Pose => ({
  pelvis: HIP,
  chest: [-78.5, -18],
  head: [-133.5, -24],
  spine: { bend: -1 },
  hands: { near: [26, -4], far: [28, -8] },
  feet: { near: along(HIP, deg, 173.4), far: [173.2, -8] },
  knees: { near: { bend: -1 }, far: { bend: -1 } },
  toes: { far: -80 },
});
/** Tall kneeling (authored facing +x), the chest leaning `lean` degrees forward. */
const kneel = (lean: number): Pose => ({
  pelvis: [0, -92],
  chest: along([0, -92], -90 + lean, 80),
  knees: { near: { at: [2, -4] }, far: { at: [-2, -4] } },
  feet: { near: along([2, -4], 178, 86), far: along([-2, -4], 178, 86) },
  toes: { near: 180, far: 180 },
});

const ASSISTED: DoodleSpec = {
  id: "test_partner",
  slug: "test-partner",
  title: "Test partner",
  frames: [
    { pose: lying(-72), hold: 0.4 },
    { pose: lying(-100), hold: 0.4 },
  ],
  partner: {
    mirror: 60,
    holds: [
      { hand: "near", on: "ankle.near" },
      { hand: "far", on: "knee.near" },
    ],
    frames: [{ pose: kneel(5) }, { pose: kneel(28) }],
  },
};

describe("partner figure", () => {
  it("is solved on the exerciser's clock: same holds, transitions and sample count", () => {
    const main = sampleTimeline(ASSISTED);
    const partner = partnerFlat(ASSISTED, main.poses, main.keyframeIndex)!;
    expect(partner.poses).toHaveLength(main.poses.length);
    expect(partner.timeline.keyTimes).toEqual(main.keyTimes);
    expect(partner.spec.frames.map((f) => f.hold)).toEqual([0.4, 0.4]);
  });

  it("pins held hands at each keyframe to the exerciser's joint, reflected into the partner's own frame", () => {
    const main = sampleTimeline(ASSISTED);
    const keys = main.keyframeIndex.map((i) => main.poses[i]);
    const derived = partnerSpec(ASSISTED, keys);
    const ankle = keys[1].legs.near.joint;
    expect(derived.frames[1].pose).toMatchObject({ hands: { near: [120 - ankle[0], ankle[1]] } });
    expect(jointOf(keys[1], "knee.near")).toEqual(keys[1].legs.near.mid);
    expect(jointOf(keys[1], "thigh.near")).toEqual([(keys[1].legs.near.root[0] + keys[1].legs.near.mid[0]) / 2, (keys[1].legs.near.root[1] + keys[1].legs.near.mid[1]) / 2]);
  });

  it("faces the exerciser (mirrored) and keeps its hands on the held joints on every sample", () => {
    const main = sampleTimeline(ASSISTED);
    const partner = partnerFlat(ASSISTED, main.poses, main.keyframeIndex)!;
    // Authored its shins run back (-x); drawn reflected they run to +x, behind a partner facing the exerciser.
    expect(partner.poses[0].legs.near.joint[0]).toBeGreaterThan(partner.poses[0].pelvis[0]);
    for (const [i, pose] of partner.poses.entries()) {
      expect(dist(pose.arms.near.end, main.poses[i].legs.near.joint)).toBeLessThan(1e-6);
      expect(dist(pose.arms.near.root, pose.arms.near.mid)).toBeCloseTo(60, 6);
    }
    expect(holdSlips(ASSISTED, partner.poses, main.poses)).toEqual([]);
  });

  it("is drawn first, paler and thinner, and inside the bounds", () => {
    const svg = renderDoodleSvg(ASSISTED);
    const group = `<g opacity="${PARTNER_OPACITY}" stroke-width="${PARTNER_WIDTH}">`;
    expect(svg).toContain(group);
    // Before the exerciser: the partner group comes before the exerciser's head circle at full strength.
    expect(svg.indexOf(group)).toBeLessThan(svg.lastIndexOf('style="fill:var(--doodle-paper, #000)"'));
    const main = sampleTimeline(ASSISTED);
    const partner = partnerFlat(ASSISTED, main.poses, main.keyframeIndex)!;
    const box = specViewBox(ASSISTED);
    for (const pose of partner.poses) {
      for (const { point } of figurePoints(pose)) {
        expect(point[0]).toBeGreaterThanOrEqual(box.x);
        expect(point[0]).toBeLessThanOrEqual(box.x + box.w);
        expect(point[1]).toBeGreaterThanOrEqual(box.y);
      }
    }
    expect(validateSpec(ASSISTED)).toMatchObject({ ok: true });
  });

  it("two views: drawn on both panels, holds kept in 3D", () => {
    const dual: DoodleSpec = { ...ASSISTED, views: ["side", "front"] };
    expect(validateSpec(dual)).toMatchObject({ ok: true });
    const svg = renderDoodleSvg(dual);
    expect(svg.match(/<g opacity="0\.55" stroke-width="5">/g)).toHaveLength(2);
    const timeline = sampleTimeline3(dual);
    const partner = partner3D(dual, timeline)!;
    expect(holdSlips(dual, partner.figures, timeline.poses)).toEqual([]);
    expect(dualLayout(dual).extras.front.partner?.poses).toHaveLength(timeline.poses.length);
  });

  it("the validator checks the partner's anatomy and reports a hold out of reach", () => {
    const bad: DoodleSpec = { ...ASSISTED, partner: { ...ASSISTED.partner!, frames: [{ pose: { ...kneel(5), feet: { near: [-200, -8] } } }, ASSISTED.partner!.frames[1]] } };
    expect(validateSpec(bad).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^partner: frame 0: feet\.near unreachable/)]));
    const far: DoodleSpec = { ...ASSISTED, partner: { ...ASSISTED.partner!, mirror: 200 } };
    expect(validateSpec(far).errors).toEqual(expect.arrayContaining([expect.stringMatching(/^partner hands\.near on ankle\.near slips off by [\d.]+ \(t=0s\): out of reach$/)]));
  });

  it("guards: one keyframe each, known joints, no hand both held and pinned, no turning round", () => {
    const partner = ASSISTED.partner!;
    expect(partnerGuards({ ...ASSISTED, partner: { ...partner, frames: [partner.frames[0]] } })).toEqual(["partner has 1 keyframes, the exerciser 2: give one per keyframe"]);
    expect(partnerGuards({ ...ASSISTED, partner: { ...partner, holds: [{ hand: "near", on: "nose.near" as "knee.near" }] } })).toEqual(['partner hold on unknown joint "nose.near"']);
    const pinned = { ...partner, frames: [{ pose: { ...kneel(5), hands: { near: [40, -150] as Point } } }, partner.frames[1]] };
    expect(partnerGuards({ ...ASSISTED, partner: pinned })).toEqual(["partner hands.near is held on ankle.near: don't pin it in the pose too"]);
    expect(partnerGuards({ ...ASSISTED, frames: [ASSISTED.frames[0], { ...ASSISTED.frames[1], mirror: 0 }] })).toEqual(["partner can't be combined with mirror keyframes (turning round)"]);
    expect(partnerGuards({ ...ASSISTED, partner: { ...partner, frames: partner.frames.map((f) => ({ ...f, sideways: { pelvis: 40 } })) } })).toEqual([
      'partner sideways needs views: ["side", "front"] or ["side", "top"]',
    ]);
    expect(partnerGuards(ASSISTED)).toEqual([]);
  });
});
