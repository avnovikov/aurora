# Rest Go-On Easy-Only + Cue Height Latch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer “Want to go on?” only in the **easy** HR zone, keep rest-expiry recovery on easy+steady, and latch two-line cue height after go-on so Get ready / count keep one empty row.

**Architecture:** Split offer vs expiry zone sets in `restPulse.ts`. When the rest timer paints go-on, set `data-rest-cue-latch` on `[data-rest-cue]` and CSS raises `min-height` to two lines; clear the attribute on `finish` / `clear`.

**Tech Stack:** TypeScript, Vitest (happy-dom for timer tests), existing session CSS.

**Spec:** `docs/superpowers/specs/2026-11-21-rest-go-on-easy-only-design.md`

## Global Constraints

- Go-on offer: zone `easy` only; once per rest; blocked when `secondsLeft <= GET_READY_AT_SECONDS_LEFT`.
- Rest expiry: `shouldAddRest` remains false for `easy` and `steady` (steady still ends rest without +30).
- Latch attribute: `data-rest-cue-latch` on `[data-rest-cue]`; two-line min-height = `48px` (2 × `line-height: 24px`).
- Latch only after go-on has been offered this rest; clear on `finish` and `clear`.
- No copy, WAV, swipe-skip, or zone-boundary changes.
- Branch from `origin/dev`; PR targets `dev`; name `feature/<issue>-rest-go-on-easy-only`.

---

### Task 0: Issue + worktree

**Files:**
- Create: GitHub issue
- Create: git worktree under `.worktrees/` from `origin/dev`

**Interfaces:**
- Produces: issue number `N`; worktree path; branch `feature/252-rest-go-on-easy-only`

- [ ] **Step 1: Create the issue**

```bash
gh issue create --title "Rest go-on only in easy zone + cue height latch" --body "$(cat <<'EOF'
## Summary
Propose skipping rest (“Want to go on?”) only when pulse is in **easy**. Keep rest-expiry recovery on **easy** and **steady**. After go-on, keep one empty cue row under Get ready / count.

## Acceptance criteria
- [ ] `shouldOfferRestedGoOn` is true only for `easy` (not `steady`)
- [ ] `shouldAddRest` still false for `easy` and `steady`
- [ ] Rest timer never paints/speaks go-on for `steady`
- [ ] After go-on, `[data-rest-cue]` has `data-rest-cue-latch` and keeps it through end-cluster cues
- [ ] Latch cleared on `finish` / `clear`
- [ ] Focused Vitest files pass

## Spec
`docs/superpowers/specs/2026-11-21-rest-go-on-easy-only-design.md`
EOF
)"
```

- [ ] **Step 2: Fetch and add worktree** (from the primary repo checkout, not a dirty feature tree)

```bash
git fetch origin dev
git worktree add .worktrees/N-rest-go-on-easy-only -b feature/252-rest-go-on-easy-only origin/dev
```

Replace `N` with the issue number. Copy or cherry-pick the design spec onto the branch if it is not already on `origin/dev`.

- [ ] **Step 3: Continue all later tasks inside that worktree**

---

### Task 1: Offer only in easy (`restPulse`)

**Files:**
- Modify: `tests/ui/restPulse.test.ts`
- Modify: `src/ui/restPulse.ts`
- Test: `tests/ui/restPulse.test.ts`

**Interfaces:**
- Consumes: `HeartRateZone`, `GET_READY_AT_SECONDS_LEFT`
- Produces: `shouldOfferRestedGoOn` true only when `zone === "easy"` (plus existing guards); `shouldAddRest` unchanged (false for easy+steady)

- [ ] **Step 1: Update failing tests** in `tests/ui/restPulse.test.ts`

Replace the steady-asks case and adjust “asks only once” / Get-ready quiet cases to use `easy` where the offer path is under test. Add an explicit steady stays quiet case:

```typescript
it("stays quiet when the pulse is steady", () => {
  expect(
    shouldOfferRestedGoOn({
      zone: "steady",
      secondsLeft: GET_READY_AT_SECONDS_LEFT + 1,
      alreadyAsked: false,
    }),
  ).toBe(false);
});

it("asks when the pulse is easy just above Get ready", () => {
  expect(
    shouldOfferRestedGoOn({
      zone: "easy",
      secondsLeft: GET_READY_AT_SECONDS_LEFT + 1,
      alreadyAsked: false,
    }),
  ).toBe(true);
});

it("asks when the pulse is easy", () => {
  expect(
    shouldOfferRestedGoOn({
      zone: "easy",
      secondsLeft: 40,
      alreadyAsked: false,
    }),
  ).toBe(true);
});

it.each(["steady", "work", "hard", "max"] as const)(
  "stays quiet in %s",
  (zone) => {
    expect(
      shouldOfferRestedGoOn({ zone, secondsLeft: 40, alreadyAsked: false }),
    ).toBe(false);
  },
);

it("asks only once", () => {
  expect(
    shouldOfferRestedGoOn({
      zone: "easy",
      secondsLeft: 40,
      alreadyAsked: true,
    }),
  ).toBe(false);
});

it("stays quiet in the Get ready window", () => {
  expect(
    shouldOfferRestedGoOn({
      zone: "easy",
      secondsLeft: GET_READY_AT_SECONDS_LEFT,
      alreadyAsked: false,
    }),
  ).toBe(false);
});
```

Keep the existing `shouldAddRest` tests unchanged (steady/easy still end rest).

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/ui/restPulse.test.ts
```

Expected: FAIL — steady still returns true from `shouldOfferRestedGoOn`.

- [ ] **Step 3: Implement** in `src/ui/restPulse.ts`

```typescript
const RESTED_ENOUGH_TO_END = new Set<HeartRateZone>(["easy", "steady"]);
const GO_ON_ZONES = new Set<HeartRateZone>(["easy"]);

/**
 * One offer to start early, only in the lowest band (`easy`).
 * The last 10 seconds belong to Get ready.
 */
export function shouldOfferRestedGoOn(input: RestedOfferInput): boolean {
  if (input.alreadyAsked || input.zone === null) {
    return false;
  }
  if (input.secondsLeft <= GET_READY_AT_SECONDS_LEFT) {
    return false;
  }
  return GO_ON_ZONES.has(input.zone);
}

/** True when expiry should add another 30 seconds instead of starting the next set. */
export function shouldAddRest(zone: HeartRateZone | null): boolean {
  if (zone === null) {
    return false;
  }
  return !RESTED_ENOUGH_TO_END.has(zone);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/ui/restPulse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/restPulse.ts tests/ui/restPulse.test.ts
git commit -m "$(cat <<'EOF'
feat(#252): offer rest go-on only in easy zone

EOF
)"
```

---

### Task 2: Timer tests for easy-only go-on + latch

**Files:**
- Modify: `tests/ui/sessionRestPulse.test.ts`
- Modify: `src/ui/sessionRest.ts`
- Modify: `src/styles/session.css`
- Test: `tests/ui/sessionRestPulse.test.ts`

**Interfaces:**
- Consumes: `shouldOfferRestedGoOn`, `REST_GO_ON`
- Produces: when go-on is offered, `[data-rest-cue]` gets `data-rest-cue-latch`; attribute removed in `finish` and `clear`

- [ ] **Step 1: Upgrade the cue mock and rewrite offer tests** in `tests/ui/sessionRestPulse.test.ts`

Change `restRoot` so the cue element supports attributes:

```typescript
function restRoot(): {
  root: HTMLElement;
  left: { textContent: string };
  cue: {
    textContent: string;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    hasAttribute(name: string): boolean;
  };
} {
  const left = { textContent: "" };
  const attrs = new Map<string, string>();
  const cue = {
    textContent: "",
    getAttribute(name: string) {
      return attrs.has(name) ? attrs.get(name)! : null;
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
  };
  const root = {
    querySelector(selector: string) {
      if (selector === "[data-rest-left]") {
        return left;
      }
      if (selector === "[data-rest-cue]") {
        return cue;
      }
      return null;
    },
  } as unknown as HTMLElement;
  return { root, left, cue };
}
```

Replace steady go-on cases with easy; assert steady never offers; add latch coverage:

```typescript
it("asks on the first second above Get ready when the pulse is already easy", () => {
  const { root, cue } = restRoot();
  const handle = startRestTimer(
    root,
    restState(GET_READY_AT_SECONDS_LEFT + 2),
    true,
    vi.fn(),
    { readZone: () => "easy" },
  );

  advanceSeconds(1);
  expect(cue.textContent).toBe(REST_GO_ON.text);
  expect(countSpoken(REST_GO_ON.text)).toBe(1);
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

  handle.clear();
});

it("asks once when the pulse drops to easy, and does not ask again", () => {
  const { root, cue } = restRoot();
  let zone: HeartRateZone | null = "work";
  const handle = startRestTimer(root, restState(20), true, vi.fn(), {
    readZone: () => zone,
  });

  advanceSeconds(1);
  expect(countSpoken(REST_GO_ON.text)).toBe(0);

  zone = "easy";
  advanceSeconds(1);
  expect(cue.textContent).toBe(REST_GO_ON.text);
  expect(countSpoken(REST_GO_ON.text)).toBe(1);
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

  zone = "work";
  advanceSeconds(1);
  zone = "easy";
  advanceSeconds(5);
  expect(countSpoken(REST_GO_ON.text)).toBe(1);
  expect(cue.textContent).toBe(REST_GO_ON.text);

  handle.clear();
});

it("does not offer go-on when the pulse is only steady", () => {
  const { root, cue } = restRoot();
  const handle = startRestTimer(root, restState(20), true, vi.fn(), {
    readZone: () => "steady",
  });

  advanceSeconds(5);
  expect(countSpoken(REST_GO_ON.text)).toBe(0);
  expect(cue.textContent).not.toBe(REST_GO_ON.text);
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(false);

  handle.clear();
});

it("shows the go-on cue without speaking when voice is off", () => {
  const { root, cue } = restRoot();
  const handle = startRestTimer(root, restState(20), false, vi.fn(), {
    readZone: () => "easy",
  });

  advanceSeconds(1);
  expect(cue.textContent).toBe(REST_GO_ON.text);
  expect(speakExactLine).not.toHaveBeenCalled();
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

  handle.clear();
});

it("keeps the cue latch when Get ready replaces go-on text", () => {
  const { root, cue } = restRoot();
  const handle = startRestTimer(
    root,
    restState(GET_READY_AT_SECONDS_LEFT + 2),
    true,
    vi.fn(),
    { readZone: () => "easy" },
  );

  advanceSeconds(1);
  expect(cue.textContent).toBe(REST_GO_ON.text);
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

  advanceSeconds(1);
  expect(cue.textContent).not.toBe(REST_GO_ON.text);
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

  handle.clear();
});

it("clears the cue latch on finish", () => {
  const { root, cue } = restRoot();
  const handle = startRestTimer(root, restState(20), true, vi.fn(), {
    readZone: () => "easy",
  });

  advanceSeconds(1);
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);
  handle.finish();
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(false);

  handle.clear();
});

it("clears the cue latch on clear", () => {
  const { root, cue } = restRoot();
  const handle = startRestTimer(root, restState(20), true, vi.fn(), {
    readZone: () => "easy",
  });

  advanceSeconds(1);
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);
  handle.clear();
  expect(cue.hasAttribute("data-rest-cue-latch")).toBe(false);
});
```

Update the “settles inside Get ready” case to use `easy` (still must not offer inside the window). Leave the hot-expiry cases that use `steady` to end rest as they are.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/ui/sessionRestPulse.test.ts
```

Expected: FAIL — latch attribute missing; steady may still offer until Task 1 is on the branch.

- [ ] **Step 3: Implement latch + paint wiring** in `src/ui/sessionRest.ts`

Extend tick state and paint:

```typescript
interface RestTickState {
  alreadyAsked: boolean;
  cueLatch: boolean;
  heldCue: CoachLine | null;
  schedule: RestCueEvent[];
  spokenForRest: Set<number>;
}

function paintRest(
  root: HTMLElement,
  left: number,
  schedule: readonly RestCueEvent[],
  heldCue: CoachLine | null,
  cueLatch: boolean,
): void {
  setText(root, "[data-rest-left]", String(Math.max(left, 0)));
  setText(root, "[data-rest-cue]", visibleRestCue(left, schedule, heldCue));
  setCueLatch(root, cueLatch);
}

function setCueLatch(root: HTMLElement, latched: boolean): void {
  const el = root.querySelector("[data-rest-cue]");
  if (!el) {
    return;
  }
  if (latched) {
    el.setAttribute("data-rest-cue-latch", "");
  } else {
    el.removeAttribute("data-rest-cue-latch");
  }
}
```

In `startRestTimer`:

```typescript
const tickState: RestTickState = {
  alreadyAsked: false,
  cueLatch: false,
  heldCue: null,
  schedule: restSchedule(state.restLeft, withVoice, timedNext),
  spokenForRest: new Set<number>(),
};

const paint = (): void => {
  paintRest(
    root,
    state.restLeft,
    tickState.schedule,
    tickState.heldCue,
    tickState.cueLatch,
  );
};

const clearCueLatch = (): void => {
  tickState.cueLatch = false;
  setCueLatch(root, false);
};

const finish = (): void => {
  if (finished) {
    return;
  }
  finished = true;
  window.clearInterval(timerId);
  state.restLeft = 0;
  clearCueLatch();
  onDoneRest();
};

// in onTick when offering:
tickState.alreadyAsked = true;
tickState.heldCue = REST_GO_ON;
tickState.cueLatch = true;
speakLine(REST_GO_ON);

return {
  clear: () => {
    window.clearInterval(timerId);
    clearCueLatch();
  },
  finish,
};
```

- [ ] **Step 4: Add CSS** in `src/styles/session.css` after `.session .rest-cue`:

```css
.session .rest-cue[data-rest-cue-latch] {
  min-height: 48px;
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run tests/ui/sessionRestPulse.test.ts tests/ui/restPulse.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/sessionRest.ts src/styles/session.css tests/ui/sessionRestPulse.test.ts
git commit -m "$(cat <<'EOF'
feat(#252): latch rest cue height after go-on offer

EOF
)"
```

---

### Task 3: Verify + open PR

**Files:** none beyond prior commits; include the design spec on the branch if missing.

- [ ] **Step 1: Run focused suite**

```bash
npx vitest run tests/ui/restPulse.test.ts tests/ui/sessionRestPulse.test.ts
```

Expected: PASS.

- [ ] **Step 2: Ensure spec is on the branch**

```bash
git add docs/superpowers/specs/2026-11-21-rest-go-on-easy-only-design.md docs/superpowers/plans/2026-11-21-rest-go-on-easy-only.md
git status
# commit if not already present
```

- [ ] **Step 3: Push and open PR against `dev`**

```bash
git push -u origin HEAD
gh pr create --base dev --title "feat(#252): rest go-on only in easy + cue latch" --body "$(cat <<'EOF'
## Summary
- Offer “Want to go on?” only when HR zone is **easy** (steady no longer offers)
- Rest expiry still treats **easy** and **steady** as recovered (no +30)
- After go-on, latch two-line cue height so Get ready / count keep one empty row

Closes #252

## Spec
docs/superpowers/specs/2026-11-21-rest-go-on-easy-only-design.md

## Test plan
- [ ] `npx vitest run tests/ui/restPulse.test.ts tests/ui/sessionRestPulse.test.ts`
- [ ] Manual: connect pulse, rest in steady → no go-on; drop to easy → go-on once; watch Get ready / count keep cue height
EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Offer only in easy | Task 1 |
| Expiry still easy+steady | Task 1 (`RESTED_ENOUGH_TO_END`) |
| Latch after go-on; keep through end-cluster | Task 2 |
| Clear latch on finish/clear | Task 2 |
| CSS two-line min-height | Task 2 |
| Out of scope (copy, swipe, WAVs) | Not planned |
