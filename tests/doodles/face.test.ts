import { describe, expect, it } from "vitest";
import { faceBlends, faceMarks2D, faceMarks3, NOSE_FROM, NOSE_TO } from "../../src/doodles/face";
import { dualLayout } from "../../src/doodles/renderDual";
import { figureExtent, flatExtras, extraPoints, renderDoodleSvg, specViewBox } from "../../src/doodles/renderSvg";
import { BONES, dist, faceHead, sampleTimeline, SEGMENTS, solvePose, type DoodleSpec, type Pose } from "../../src/doodles/rig";
import { dist3, sampleTimeline3 } from "../../src/doodles/rig3d";
import { faceGuards, validateSpec } from "../../src/doodles/validate";

const stand = (extra: Partial<Pose> = {}): Pose => ({
  pelvis: [0, -172],
  chest: [0, -252],
  hands: { near: [8, -146], far: [4, -146] },
  feet: { near: [6, 0], far: [0, 0] },
  toes: { near: 0, far: 0 },
  ...extra,
});

const TURN: DoodleSpec = {
  id: "test_turn",
  slug: "test-turn",
  title: "Test turn",
  frames: [
    { pose: stand(), hold: 0.3, face: { turn: 0 } },
    { pose: stand(), hold: 0.3, face: { turn: -80 } },
  ],
};
const TURN_DUAL: DoodleSpec = { ...TURN, views: ["side", "front"] };
const r = SEGMENTS.headRadius;

describe("head facing: blending", () => {
  it("blends turn, tilt and nod between keyframes like the limbs (eased), keyframes exact", () => {
    const timeline = sampleTimeline(TURN);
    const blends = faceBlends(TURN, timeline.poses.length);
    const [k0, k1] = timeline.keyframeIndex;
    expect(blends[k0].turn).toBe(0);
    expect(blends[k1].turn).toBe(-80);
    // Halfway through the transition (step 7 of 14): eased 0.5.
    expect(blends[k0 + 8].turn).toBeCloseTo(-40, 6);
    expect(blends[blends.length - 1].turn).toBe(0);
    expect(blends[k0 + 1].tilt).toBe(0);
  });

  it("a nod turns the free head about the neck (bone kept); a pinned head stays put", () => {
    const pose = stand();
    const solved = solvePose(pose);
    const nodded = faceHead(solved, pose, { nod: 40 }, "side");
    expect(dist(nodded.neck, nodded.head)).toBeCloseTo(BONES.neckHead, 9);
    // Chin down: the head comes forward (+x) and down.
    expect(nodded.head[0]).toBeGreaterThan(solved.head[0] + 20);
    expect(nodded.head[1]).toBeGreaterThan(solved.head[1]);
    const pinned = stand({ head: [-12, -306] });
    const held = solvePose(pinned);
    expect(faceHead(held, pinned, { nod: 40 }, "side")).toBe(held);
    // A front view turns the head by its tilt instead (+ towards +x, the far side).
    expect(faceHead(solved, pose, { tilt: 30 }, "front").head[0]).toBeGreaterThan(solved.head[0] + 10);
  });

  it("the nod is blended over the transition through the spine", () => {
    const spec: DoodleSpec = { ...TURN, frames: [{ pose: stand(), hold: 0.3, face: {} }, { pose: stand(), hold: 0.3, face: { nod: 40 } }] };
    const { poses, keyframeIndex } = sampleTimeline(spec);
    const xs = poses.slice(keyframeIndex[0], keyframeIndex[1] + 1).map((p) => p.head[0]);
    expect(xs[xs.length - 1]).toBeGreaterThan(xs[0] + 20);
    const mid = xs[8];
    expect(mid).toBeGreaterThan(xs[0] + 5);
    expect(mid).toBeLessThan(xs[xs.length - 1] - 5);
  });

  it("two views: a tilt swings the head sideways, bone kept, the side view sees it a little lower", () => {
    const spec: DoodleSpec = { ...TURN_DUAL, frames: [{ pose: stand(), hold: 0.3, face: {} }, { pose: stand(), hold: 0.3, face: { tilt: 30 } }] };
    const timeline = sampleTimeline3(spec);
    const k1 = timeline.poses[timeline.keyframeIndex[1]];
    expect(k1.head[2]).toBeCloseTo(BONES.neckHead * Math.sin(Math.PI / 6), 6);
    expect(dist3(k1.neck, k1.head)).toBeCloseTo(BONES.neckHead, 9);
    expect(k1.head[1]).toBeGreaterThan(timeline.poses[0].head[1]);
    expect(validateSpec(spec)).toMatchObject({ ok: true });
  });
});

describe("head facing: the nose tick", () => {
  it("side view: a profile nose out of the front of the head, past the circle", () => {
    const poses = sampleTimeline(TURN).poses;
    const [mark] = faceMarks2D(TURN, poses)!;
    const head = poses[0].head;
    expect(mark.from).toEqual([head[0] + NOSE_FROM * r, head[1]]);
    expect(mark.to[0]).toBeCloseTo(head[0] + NOSE_TO * r, 9);
    expect(mark.front).toBe(true);
  });

  it("front panel: a dot in the middle of the face looking ahead, a tick to the viewer's left turned to the near side", () => {
    const timeline = sampleTimeline3(TURN_DUAL);
    const front = faceMarks3(TURN_DUAL, timeline.poses, "front")!;
    const head = timeline.poses[0].head;
    expect(front[0].from[0]).toBeCloseTo(head[2], 9);
    expect(front[0].to[0]).toBeCloseTo(head[2], 9);
    const k1 = timeline.keyframeIndex[1];
    expect(front[k1].to[0]).toBeLessThan(head[2] - r);
    expect(front[k1].front).toBe(true);
    // Side panel: turned towards the camera the tick foreshortens onto the face, drawn over the head.
    const side = faceMarks3(TURN_DUAL, timeline.poses, "side")!;
    expect(side[k1].to[0] - side[k1].from[0]).toBeCloseTo((NOSE_TO - NOSE_FROM) * r * Math.cos((80 * Math.PI) / 180), 6);
    expect(side[k1].front).toBe(true);
    // Turned away from the camera it is behind the head.
    const away: DoodleSpec = { ...TURN_DUAL, frames: [TURN_DUAL.frames[0], { ...TURN_DUAL.frames[1], face: { turn: 80 } }] };
    expect(faceMarks3(away, sampleTimeline3(away).poses, "side")![k1].front).toBe(false);
    // From above it points where the face does (+ turn: towards the far side, up the top panel).
    const top = faceMarks3(away, sampleTimeline3(away).poses, "top")!;
    expect(top[k1].to[1]).toBeLessThan(top[k1].from[1]);
  });

  it("is drawn with the head: under the circle while hidden, over it while in front, at the tick's width", () => {
    const svg = renderDoodleSvg(TURN);
    expect(svg.match(/stroke-width="5"/g)).toHaveLength(1);
    expect(renderDoodleSvg({ ...TURN, frames: TURN.frames.map(({ face: _face, ...frame }) => frame) })).not.toContain('stroke-width="5"');
    const away: DoodleSpec = { ...TURN_DUAL, frames: [TURN_DUAL.frames[0], { ...TURN_DUAL.frames[1], face: { turn: 80 } }] };
    const dual = renderDoodleSvg(away);
    // Side panel: a back copy plus a front copy that hides while the face is turned away; front panel: one copy.
    expect(dual.match(/stroke-width="5"/g)).toHaveLength(3);
    expect(dual).toMatch(/stroke-width="5" opacity="1"><animate attributeName="points"[^>]*\/><animate attributeName="opacity" values="1;/);
  });

  it("the drawing's bounds take in the nose", () => {
    const timeline = sampleTimeline(TURN);
    const { poses } = timeline;
    const extras = flatExtras(TURN, timeline);
    const box = figureExtent(poses, [], TURN, "side", extraPoints(extras));
    const nose = Math.max(...faceMarks2D(TURN, poses)!.map((m) => m.to[0]));
    expect(box.x + box.w).toBeGreaterThan(nose);
    expect(specViewBox(TURN).w).toBeGreaterThanOrEqual(specViewBox({ ...TURN, frames: TURN.frames.map(({ face: _face, ...frame }) => frame) }).w);
    const layout = dualLayout(TURN_DUAL);
    expect(layout.extras.front.faces).toHaveLength(layout.front.length);
  });
});

describe("head facing: guards and validator", () => {
  it("passes a plain head turn", () => {
    expect(validateSpec(TURN)).toMatchObject({ ok: true });
    expect(validateSpec(TURN_DUAL)).toMatchObject({ ok: true });
  });

  it("rejects turns past the neck's range, a tilt a side view can't show, and turning round", () => {
    expect(faceGuards({ frames: [{ face: { turn: 120 } }] })).toEqual(["frame 0: face.turn 120° is past 90°"]);
    expect(faceGuards({ frames: [{ face: { nod: -70 } }] })).toEqual(["frame 0: face.nod -70° is past 60°"]);
    expect(faceGuards({ frames: [{ face: { tilt: 20 } }] })[0]).toMatch(/^face\.tilt swings the head sideways/);
    expect(faceGuards({ frames: [{ face: { tilt: 20 } }], view: "front" })).toEqual([]);
    expect(faceGuards({ frames: [{ face: { turn: 10 } }, { mirror: 0 }] })).toEqual(["face can't be combined with mirror (turning round)"]);
    expect(validateSpec({ ...TURN, frames: [TURN.frames[0], { ...TURN.frames[1], face: { tilt: 20 } }] }).ok).toBe(false);
  });
});
