/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import {
  warmupLightenConfirmHtml,
  wireWarmupLightenConfirm,
} from "../../src/ui/warmupLightenConfirm";

describe("warmup lighten confirm", () => {
  it("marks Keep it light as the primary when the forest prefers light", () => {
    const html = warmupLightenConfirmHtml(true);
    expect(html).toContain("You look wound up");
    expect(html).toMatch(/class="cta"[^>]*data-lighten-yes/);
    expect(html).toMatch(/class="btn-quiet"[^>]*data-lighten-no/);
  });

  it("wires both choices", () => {
    const root = document.createElement("div");
    root.innerHTML = warmupLightenConfirmHtml(false);
    const onLight = vi.fn();
    const onKeep = vi.fn();
    wireWarmupLightenConfirm(root, { onLight, onKeep });
    root.querySelector<HTMLButtonElement>("[data-lighten-yes]")?.click();
    root.querySelector<HTMLButtonElement>("[data-lighten-no]")?.click();
    expect(onLight).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });
});
