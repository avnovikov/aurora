import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import { checkInHtml } from "../../src/ui/checkIn";
import { comingUpHtml } from "../../src/ui/comingUp";
import { overrideControlsHtml } from "../../src/ui/overrideControls";
import { todayHomeHtml } from "../../src/ui/todayHome";
import { useMemoryStorage } from "../helpers/storage";

const legs = SESSION_TEMPLATES.find((t) => t.name === "Legs")!;
const bars = SESSION_TEMPLATES.find((t) => t.name === "Bars")!;
const model = (over: Partial<Parameters<typeof todayHomeHtml>[0]> = {}) => ({
  next: legs,
  isOverride: false,
  upcoming: [legs, legs, bars],
  deloadActive: false,
  overrideHtml: "",
  ...over,
});
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Today page", () => {
  const html = todayHomeHtml(model());

  it("has one h1 and names today's session once, in the card", () => {
    expect(count(html, "<h1")).toBe(1);
    expect(html).toContain('<h2 id="today-session">Lower body</h2>');
    expect(html).toContain("Next up");
    expect(html.indexOf("today-card")).toBeLessThan(html.indexOf("data-checkin"));
  });

  it("reads top-down: title, Next up with the duration on its row, name, goal, warm-up", () => {
    const order = [
      "Aurora · Rassvet",
      "<h1",
      'class="today-nextrow"',
      "Next up",
      'class="today-duration"',
      'id="today-session"',
      'class="today-goal">Toward ',
      "data-warmup-preview",
    ].map((needle) => html.indexOf(needle));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const nextRow = html.slice(html.indexOf('class="today-nextrow"'), html.indexOf('id="today-session"'));
    expect(nextRow).toMatch(/Next up<\/p>\s*<p class="today-duration">≈ \d+ min<\/p>/);
  });

  it("puts the check-in in its own panel after the reading area, then Coming up and the override", () => {
    expect(html).toContain('<section class="today-act" aria-label="Check-in"><div data-checkin></div></section>');
    expect(html.indexOf("today-read")).toBeLessThan(html.indexOf("today-act"));
    const withOverride = todayHomeHtml(model({ overrideHtml: "<details data-override-controls></details>" }));
    expect(withOverride.indexOf("data-checkin")).toBeLessThan(withOverride.indexOf("data-forecast"));
    expect(withOverride.indexOf("data-forecast")).toBeLessThan(withOverride.indexOf("data-override-controls"));
  });

  it("does not repeat today's session in Coming up", () => {
    const comingUp = html.slice(html.indexOf("coming-up"));
    expect(comingUp).toContain("Then 2");
    expect(comingUp).toContain("Then 3");
    expect(comingUp).not.toContain("Next up");
    expect(count(comingUp, "<li>")).toBe(2);
  });

  it("keeps the warm-up and cool-down preview from #38 in the card", () => {
    expect(html).toMatch(/data-warmup-preview>Warm-up · beginner · \d+ min/);
    expect(html.indexOf("data-warmup-preview")).toBeLessThan(html.indexOf("data-checkin"));
  });

  it("shows the warm-up level picked for today", () => {
    expect(todayHomeHtml(model({ warmupLevel: "intermediate" }))).toMatch(
      /data-warmup-preview>Warm-up · intermediate · \d+ min/,
    );
  });

  it("labels an override as today instead", () => {
    expect(todayHomeHtml(model({ isOverride: true, next: bars }))).toContain("Today instead");
  });

  it("shows the deload note inside the card only while active", () => {
    expect(html).not.toContain("data-deload-note");
    const deload = todayHomeHtml(model({ deloadActive: true }));
    expect(deload.indexOf("data-deload-note")).toBeLessThan(deload.indexOf("data-checkin"));
  });
});

describe("check-in", () => {
  const html = checkInHtml("Start Legs");

  it("names the session on Start and explains why it starts disabled", () => {
    expect(html).toMatch(/data-start disabled>Start Legs</);
    expect(html).toContain("Pick how you slept to start.");
  });

  it("drops the developer note and the duplicate branding", () => {
    expect(html).not.toMatch(/Wi.?Fi|the Mac|Rassvet|<h1/);
  });

  it("says Lower back, like the rest of the app, and marks pain as optional", () => {
    expect(html).toContain(">Lower back<");
    expect(html).not.toContain(">Lumbar<");
    expect(html).toContain("Optional");
  });

  it("uses accessible chips: pick-one for sleep, toggles for pain", () => {
    expect(count(html, 'data-sleep-value="')).toBe(3);
    expect(html).toMatch(/data-sleep-value="good" class="" aria-pressed="false"/);
    expect(count(html, 'data-kind="toggle"')).toBe(5);
    expect(html).toMatch(/role="group" aria-label="How did you sleep\?"/);
  });

  it("lays sleep out as a row of three and pain as a grid", () => {
    expect(html).toMatch(/<div class="today-sleep" role="group" aria-label="How did you sleep\?">/);
    expect(html).toMatch(/<div class="today-pain" role="group" aria-label="Any pain today\?">/);
  });

  it("links Start to its hint and keeps the hints under it", () => {
    expect(html).toMatch(/<button type="button" class="cta today-start" aria-describedby="today-start-hint" data-start disabled>/);
    expect(html).toContain('<p class="hint" id="today-start-hint" data-start-hint>Pick how you slept to start.</p>');
    expect(html.indexOf("data-start ")).toBeLessThan(html.indexOf("data-start-hint"));
    expect(html).toContain("Starting turns on the coach's voice, so keep the sound up.");
  });
});

describe("coming up", () => {
  it("lists the sessions after today's", () => {
    const html = comingUpHtml([legs, bars]);
    expect(html).toContain("Upper body");
    expect(html).not.toContain(">Lower body<");
  });

  it("is empty when only today's session is queued, and explains an empty queue", () => {
    expect(comingUpHtml([legs])).toBe("");
    expect(comingUpHtml([])).toContain("Queue empty");
  });
});

describe("train something else today", () => {
  useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify({ items: [legs.id] }) }));

  it("is a collapsed panel with short chips, minus today's own session", () => {
    const html = overrideControlsHtml(null);
    expect(html).toMatch(/<details class="lib-filters override-controls" data-override-controls>/);
    expect(html).toContain("<summary>Train something else today</summary>");
    expect(html).toContain(`data-override="${bars.id}"`);
    expect(html).not.toContain(`data-override="${legs.id}"`);
    expect(html).not.toContain("instead today</button>");
  });

  it("opens, names the choice and offers a way back while an override is active", () => {
    const html = overrideControlsHtml({ templateId: bars.id });
    expect(html).toMatch(/data-override-controls open>/);
    expect(html).toContain("Train something else today · Upper body");
    expect(html).toMatch(new RegExp(`data-override="${bars.id}" class="selected" aria-pressed="true"`));
    expect(html).toContain("Back to the plan");
  });
});
