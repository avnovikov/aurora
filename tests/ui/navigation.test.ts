import { describe, expect, it } from "vitest";
import { createNavigation, type HistoryLike } from "../../src/ui/navigation";

/** A browser history stand-in that records calls; popstate is delivered by the test. */
function fakeHistory() {
  const calls: string[] = [];
  const states: unknown[] = [null];
  const history: HistoryLike = {
    pushState: (data) => {
      states.push(data);
      calls.push(`push:${JSON.stringify(data)}`);
    },
    back: () => {
      states.pop();
      calls.push("back");
    },
    go: (delta) => {
      states.length += delta;
      calls.push(`go:${delta}`);
    },
  };
  return { history, calls, top: () => states[states.length - 1] };
}

function entry(label: string, log: string[]) {
  return { label, restore: () => void log.push(label) };
}

describe("drill-down navigation stack (#219)", () => {
  it("pushes entries and pops them most recent first, restoring each screen", () => {
    const log: string[] = [];
    const nav = createNavigation();
    nav.push(entry("Progress", log));
    nav.push(entry("History", log));
    expect(nav.depth).toBe(2);
    expect(nav.peek()?.label).toBe("History");
    expect(nav.back()).toBe(true);
    expect(nav.back()).toBe(true);
    expect(log).toEqual(["History", "Progress"]);
    expect(nav.back()).toBe(false);
    expect(nav.depth).toBe(0);
  });

  it("clear empties the stack", () => {
    const log: string[] = [];
    const nav = createNavigation();
    nav.push(entry("History", log));
    nav.clear();
    expect(nav.depth).toBe(0);
    expect(nav.back()).toBe(false);
    expect(log).toEqual([]);
  });

  it("mirrors pushes into the browser history and walks it back on Back", () => {
    const { history, calls } = fakeHistory();
    const nav = createNavigation(history);
    nav.push(entry("History", []));
    nav.push(entry("Pull-up", []));
    expect(calls).toEqual(['push:{"auroraNavDepth":1}', 'push:{"auroraNavDepth":2}']);
    nav.back();
    expect(calls.at(-1)).toBe("back");
  });

  it("clear unwinds the browser entries it pushed, so phone Back behaves as before", () => {
    const { history, calls, top } = fakeHistory();
    const nav = createNavigation(history);
    nav.push(entry("Progress", []));
    nav.push(entry("History", []));
    nav.clear();
    expect(calls.at(-1)).toBe("go:-2");
    expect(top()).toBeNull();
    nav.clear();
    expect(calls.filter((c) => c.startsWith("go"))).toHaveLength(1);
  });

  it("popstate from the phone's Back pops to the entry for that depth", () => {
    const log: string[] = [];
    const nav = createNavigation(fakeHistory().history);
    nav.push(entry("Progress", log));
    nav.push(entry("History", log));
    nav.handlePopState({ auroraNavDepth: 1 });
    expect(log).toEqual(["History"]);
    expect(nav.depth).toBe(1);
    nav.handlePopState(null);
    expect(log).toEqual(["History", "Progress"]);
    expect(nav.depth).toBe(0);
  });

  it("ignores the popstate that follows its own Back or clear", () => {
    const log: string[] = [];
    const nav = createNavigation(fakeHistory().history);
    nav.push(entry("Progress", log));
    nav.push(entry("History", log));
    nav.back();
    nav.handlePopState({ auroraNavDepth: 1 });
    expect(log).toEqual(["History"]);
    nav.clear();
    nav.handlePopState(null);
    expect(log).toEqual(["History"]);
  });

  it("does not push again while restoring a screen (no double entries)", () => {
    const { history, calls } = fakeHistory();
    const nav = createNavigation(history);
    const reentrant = {
      label: "History",
      restore: () => nav.push(entry("would-duplicate", [])),
    };
    nav.push(reentrant);
    nav.handlePopState(null);
    expect(nav.depth).toBe(0);
    nav.push(reentrant);
    nav.back();
    expect(nav.depth).toBe(0);
    expect(calls.filter((c) => c.startsWith("push"))).toHaveLength(2);
  });

  it("listens for popstate on a window and stops when detached", () => {
    const log: string[] = [];
    const target = new EventTarget();
    const nav = createNavigation();
    const detach = nav.listen(target);
    nav.push(entry("History", log));
    const pop = Object.assign(new Event("popstate"), { state: null });
    target.dispatchEvent(pop);
    expect(log).toEqual(["History"]);
    nav.push(entry("Library", log));
    detach();
    target.dispatchEvent(pop);
    expect(log).toEqual(["History"]);
  });
});
