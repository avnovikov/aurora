/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { loadLevelsToConfirm } from "../../src/session/ensureMemoryMigrated";
import { LEVELS_TO_CONFIRM_KEY } from "../../src/storage/storageKeys";
import { renderSettingsView } from "../../src/ui/settingsView";
import { useMemoryStorage } from "../helpers/storage";

describe("Settings levels to confirm (#112)", () => {
  useMemoryStorage(() => ({ [LEVELS_TO_CONFIRM_KEY]: JSON.stringify(["hf_84"]) }));

  it("Done clears the saved list and removes the section", () => {
    const root = document.createElement("div");
    renderSettingsView(root);
    expect(root.querySelector("[data-levels-to-confirm]")).not.toBeNull();
    expect(loadLevelsToConfirm()).toEqual(["hf_84"]);
    root.querySelector<HTMLButtonElement>("[data-levels-confirm-done]")!.click();
    expect(loadLevelsToConfirm()).toEqual([]);
    expect(root.querySelector("[data-levels-to-confirm]")).toBeNull();
  });
});
