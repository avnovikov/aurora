import { describe, expect, it } from "vitest";
import { PROPER_NOUNS, displayExerciseName } from "../../src/library/displayName";

describe("displayExerciseName", () => {
  it("shows title-case names in sentence case", () => {
    expect(displayExerciseName("Bodyweight Squat")).toBe("Bodyweight squat");
    expect(displayExerciseName("Hollow Body Hold")).toBe("Hollow body hold");
    expect(displayExerciseName("90-Degree Handstand Push-Up")).toBe("90-degree handstand push-up");
    expect(displayExerciseName("Child's Pose")).toBe("Child's pose");
  });

  it("leaves names already in sentence case alone", () => {
    expect(displayExerciseName("Bulgarian split squat")).toBe("Bulgarian split squat");
    expect(displayExerciseName("Cossack squat")).toBe("Cossack squat");
    expect(displayExerciseName("Nordic curl")).toBe("Nordic curl");
  });

  it("keeps proper nouns capitalised wherever they sit", () => {
    expect(displayExerciseName("Single-Leg Romanian Deadlift")).toBe("Single-leg Romanian deadlift");
    expect(displayExerciseName("Reverse Nordic Curl")).toBe("Reverse Nordic curl");
    expect(displayExerciseName("Copenhagen Adduction Exercise")).toBe("Copenhagen adduction exercise");
    expect(displayExerciseName("Standing Soleus And Achilles Stretch")).toBe("Standing soleus and Achilles stretch");
    expect(displayExerciseName("Spiderman Push-Up")).toBe("Spiderman push-up");
    expect(displayExerciseName("Jefferson Curl")).toBe("Jefferson curl");
  });

  it("keeps every listed proper noun as written", () => {
    for (const noun of PROPER_NOUNS) {
      expect(displayExerciseName(`Reverse ${noun} Curl`)).toBe(`Reverse ${noun} curl`);
    }
  });

  it("keeps the capital of a letter-shaped move and lowers what follows the hyphen", () => {
    expect(displayExerciseName("V-Up")).toBe("V-up");
    expect(displayExerciseName("V-Sit")).toBe("V-sit");
    expect(displayExerciseName("W-Raise")).toBe("W-raise");
    expect(displayExerciseName("L-Sit Pull-Up")).toBe("L-sit pull-up");
    expect(displayExerciseName("Straddle L-Sit")).toBe("Straddle L-sit");
    expect(displayExerciseName("Roll-overs into V-sits")).toBe("Roll-overs into V-sits");
    expect(displayExerciseName("Prone Y-T-W raise")).toBe("Prone Y-T-W raise");
    expect(displayExerciseName("TRX/Rings Y Raise")).toBe("TRX/rings Y raise");
  });

  it("keeps abbreviations as written", () => {
    expect(displayExerciseName("TRX Rows")).toBe("TRX rows");
    expect(displayExerciseName("Standing IT Band Stretch")).toBe("Standing IT band stretch");
    expect(displayExerciseName("Shinbox IR Stretch")).toBe("Shinbox IR stretch");
    expect(displayExerciseName("Neck CARs")).toBe("Neck CARs");
  });

  it("capitalises a name that starts in lower case", () => {
    expect(displayExerciseName("toy soldiers")).toBe("Toy soldiers");
  });
});
