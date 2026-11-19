/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { loadLevelsToConfirm } from "../../src/session/ensureMemoryMigrated";
import { loadProfile } from "../../src/settings/profile";
import { LEVELS_TO_CONFIRM_KEY } from "../../src/storage/storageKeys";
import { settingsPageHtml } from "../../src/ui/settingsPage";
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

  it("Done after a tab switch still clears and focuses the status (#116)", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderSettingsView(root);
    root.querySelector<HTMLButtonElement>('[data-settings-tab="gear"]')?.click();
    expect(root.querySelector("[data-levels-to-confirm]")).not.toBeNull();
    root.querySelector<HTMLButtonElement>("[data-levels-confirm-done]")!.click();
    expect(loadLevelsToConfirm()).toEqual([]);
    expect(root.querySelector("[data-levels-to-confirm]")).toBeNull();
    const status = root.querySelector<HTMLElement>("[data-settings-status]");
    expect(status?.textContent).toBe("Levels to confirm cleared.");
    expect(document.activeElement).toBe(status);
    root.remove();
  });

  it("escapes unknown ids and markup in the confirm list (#116)", () => {
    const html = settingsPageHtml({
      tab: "you",
      profile: loadProfile(),
      deloadActive: false,
      levelsToConfirm: [
        { id: "missing_id", name: "missing_id" },
        { id: "xss", name: '<img src=x onerror="alert(1)">' },
      ],
    });
    expect(html).toContain("<li>missing_id</li>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<img src=x");
  });
});
