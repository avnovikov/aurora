import { describe, expect, it } from "vitest";
import {
  BONES,
  HIP_SIDE,
  reach3,
  resolveSideways,
  solveKeyframes,
  type DoodleSpec,
  type AuthoredPose,
  type Point,
  type Pose,
} from "../../src/doodles/rig";

const PELVIS: Point = [-30, -87];

describe("resolveSideways", () => {
  it("returns a plain pose unchanged (same object)", () => {
    const pose: Pose = { pelvis: PELVIS, feet: { near: [-200, -18] } };
    expect(resolveSideways(pose, { feet: { near: -40 } })).toBe(pose);
  });

  it("places a knee by direction, foreshortened by knee z minus hip z", () => {
    const pose: AuthoredPose = { pelvis: PELVIS, knees: { near: { dir: 40 } } };
    const out = resolveSideways(pose, { knees: { near: { at: 24 } } });
    expect(out.knees?.near?.at).toEqual(
      reach3(PELVIS, 40, BONES.thigh, 24 + HIP_SIDE),
    );
  });

  it("places a foot from a direction knee, foreshortened by foot z minus knee z", () => {
    const pose: AuthoredPose = {
      pelvis: PELVIS,
      knees: { near: { dir: 40 } },
      feet: { near: { dir: 170 } },
    };
    const out = resolveSideways(pose, {
      knees: { near: { at: 24 } },
      feet: { near: 2 },
    });
    const knee = reach3(PELVIS, 40, BONES.thigh, 24 + HIP_SIDE);
    expect(out.feet?.near).toEqual(reach3(knee, 170, BONES.shin, 2 - 24));
  });

  it("places a straight-leg foot from the pelvis with a custom length", () => {
    const pose: AuthoredPose = {
      pelvis: PELVIS,
      feet: { far: { dir: 180, length: 173.6 } },
    };
    const out = resolveSideways(pose, { pelvis: 10, feet: { far: 78 } });
    expect(out.feet?.far).toEqual(
      reach3(PELVIS, 180, 173.6, 78 - (10 + HIP_SIDE)),
    );
  });

  it("treats a missing sideways as plain 2D (dz 0)", () => {
    const pose: AuthoredPose = {
      pelvis: PELVIS,
      knees: { far: { dir: 92 } },
      feet: { far: { dir: 200 } },
    };
    const out = resolveSideways(pose);
    const knee = reach3(PELVIS, 92, BONES.thigh, 0);
    expect(out.knees?.far?.at).toEqual(knee);
    expect(out.feet?.far).toEqual(reach3(knee, 200, BONES.shin, 0));
  });

  it("spreads planted feet in along the floor so legs keep their length", () => {
    const plain: AuthoredPose = {
      pelvis: PELVIS,
      feet: { near: [-200, -18], far: [-200, -18] },
      spreadFeet: true,
    };
    const out = resolveSideways(plain, { pelvis: -20, feet: { near: -40, far: 40 } });
    // Spread literals checked against the old spreadFeet formula and the byte-identical snapshot.
    expect(out.feet?.near).toEqual([-199.36, -18]);
    expect(out.feet?.far).toEqual([-191.63, -18]);
  });

  it("spreads only the Point foot when the other foot is a direction hint", () => {
    const pose: AuthoredPose = {
      pelvis: PELVIS,
      feet: { near: [-200, -18], far: { dir: 170 } },
      spreadFeet: true,
    };
    const sw = { pelvis: -20, feet: { near: -40, far: 40 } };
    const out = resolveSideways(pose, sw);
    expect(out.feet?.near).toEqual([-199.36, -18]);
    expect(out.feet?.far).toEqual(reach3(PELVIS, 170, BONES.thigh + BONES.shin, 40 - (-20 + HIP_SIDE)));
  });

  it("rejects a knee hint with both dir and at", () => {
    expect(() => resolveSideways({ pelvis: PELVIS, knees: { near: { dir: 40, at: [0, -50] } } })).toThrow(
      /both dir and at/,
    );
  });

  it("passes a knee with only bend through unchanged", () => {
    const pose: AuthoredPose = {
      pelvis: PELVIS,
      knees: { near: { bend: -1 } },
      feet: { near: { dir: 170 } },
    };
    const out = resolveSideways(pose, {});
    expect(out.knees?.near).toEqual({ bend: -1 });
  });

  it("keeps a plain knee at and hangs a foot hint off it", () => {
    const knee: Point = [-10, -40];
    const pose: AuthoredPose = {
      pelvis: PELVIS,
      knees: { near: { at: knee } },
      feet: { near: { dir: 170 } },
    };
    const out = resolveSideways(pose, { knees: { near: { at: 24 } }, feet: { near: 2 } });
    expect(out.knees?.near?.at).toEqual(knee);
    expect(out.feet?.near).toEqual(reach3(knee, 170, BONES.shin, 2 - 24));
  });

  it("resolves hints per keyframe through solveKeyframes", () => {
    const sideways = { knees: { near: { at: 24 } }, feet: { near: 2 } };
    const spec: DoodleSpec = {
      id: "t",
      slug: "t",
      title: "T",
      frames: [
        {
          hold: 0,
          pose: { pelvis: PELVIS, knees: { near: { dir: 40 } }, feet: { near: { dir: 170 } } },
          sideways,
        },
      ],
    };
    const [key] = solveKeyframes(spec);
    const knee = reach3(PELVIS, 40, BONES.thigh, 24 + HIP_SIDE);
    expect(key.pose.knees?.near?.at).toEqual(knee);
    expect(key.pose.feet?.near).toEqual(reach3(knee, 170, BONES.shin, 2 - 24));
  });

  it("needs an explicit pelvis for hints", () => {
    expect(() => resolveSideways({ knees: { near: { dir: 40 } } })).toThrow(
      /pelvis/,
    );
  });
});
