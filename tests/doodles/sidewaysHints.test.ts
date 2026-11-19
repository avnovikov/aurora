import { describe, expect, it } from "vitest";
import {
  BONES,
  HIP_SIDE,
  resolveSideways,
  type AuthoredPose,
  type Point,
  type Pose,
} from "../../src/doodles/rig";
import { reach3, spreadFeet } from "../../src/doodles/sideways";

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
      reach3(PELVIS, 40, BONES.thigh, 24 - -HIP_SIDE),
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
    const knee = reach3(PELVIS, 40, BONES.thigh, 24 - -HIP_SIDE);
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

  it("spreads planted feet exactly like spreadFeet", () => {
    const plain: Pose = {
      pelvis: PELVIS,
      feet: { near: [-200, -18], far: [-200, -18] },
    };
    const sw = { pelvis: -20, feet: { near: -40, far: 40 } };
    expect(resolveSideways({ ...plain, spreadFeet: true }, sw)).toEqual(
      spreadFeet(plain, sw),
    );
  });

  it("needs an explicit pelvis for hints", () => {
    expect(() => resolveSideways({ knees: { near: { dir: 40 } } })).toThrow(
      /pelvis/,
    );
  });
});
