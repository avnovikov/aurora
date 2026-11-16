import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_QUEUE } from "../../src/data/seed";
import { loadPlanQueue, savePlanQueue } from "../../src/plan/queue";
import { resolveTemplate } from "../../src/plan/templates";
import { loadProfile, saveProfile } from "../../src/settings/profile";
import {
  beginOnboardingQueue,
  completeOnboardingSkip,
  completeOnboardingWithArea,
} from "../../src/ui/onboarding";
import { onboardingTargetHtml } from "../../src/ui/onboardingTarget";
import { settingsPageHtml } from "../../src/ui/settingsPage";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

describe("first-run settings setup mode", () => {
  it("shows Continue and hides backup and deload", () => {
    const html = settingsPageHtml({
      tab: "you",
      profile: loadProfile(),
      deloadActive: false,
      setup: true,
    });
    expect(html).toContain("data-setup-continue");
    expect(html).toContain(">Setup<");
    expect(html).not.toContain("data-export");

    const training = settingsPageHtml({
      tab: "training",
      profile: loadProfile(),
      deloadActive: false,
      setup: true,
    });
    expect(training).not.toContain("data-deload");
    expect(training).toContain("data-mute");
  });
});

describe("first-run target step", () => {
  it("lists the four areas, disables Start until a choice, and offers Skip", () => {
    const idle = onboardingTargetHtml(null);
    expect(idle).toContain("What to train first");
    expect(idle).toContain('data-area="upper"');
    expect(idle).toContain('data-area="lower"');
    expect(idle).toContain('data-area="core"');
    expect(idle).toContain('data-area="full"');
    expect(idle).not.toContain("Skill:");
    expect(idle).toMatch(/data-start disabled/);
    expect(idle).toContain("data-skip");

    const chosen = onboardingTargetHtml("lower");
    expect(chosen).toContain('data-area="lower" class="selected"');
    expect(chosen).not.toMatch(/data-start disabled/);
  });
});

describe("first-run onboarding outcomes", () => {
  it("clears any seed queue when onboarding begins", () => {
    savePlanQueue(DEFAULT_PLAN_QUEUE);
    beginOnboardingQueue();
    expect(loadPlanQueue().items).toEqual([]);
    expect(loadProfile().setupDone).toBe(false);
  });

  it("builds an area block and marks setup done when an area is chosen", () => {
    beginOnboardingQueue();
    completeOnboardingWithArea("lower");
    expect(loadProfile().setupDone).toBe(true);
    const items = loadPlanQueue().items;
    expect(items.length).toBeGreaterThan(0);
    expect(resolveTemplate(items[0]!).name).toMatch(/^Lower body/);
  });

  it("leaves Plan empty and marks setup done on Skip", () => {
    saveProfile({ ...loadProfile(), setupDone: false });
    beginOnboardingQueue();
    completeOnboardingSkip();
    expect(loadProfile().setupDone).toBe(true);
    expect(loadPlanQueue().items).toEqual([]);
  });
});
