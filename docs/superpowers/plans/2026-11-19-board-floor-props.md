# Board and Floor Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace faked scenery with two real doodle props — `board` (a sloped plank) and `floor` (a ground line sized by the renderer) — and delete the heuristics that guessed them (issue #202, spec `docs/superpowers/specs/2026-11-19-board-floor-props-design.md`).

**Architecture:** Both props join the `Prop` union in `src/doodles/rig.ts`. A board is drawn from its segments (`propSegments` in `renderSvg.ts`) like any other line prop; its front view is built on purpose in `frontProps` (`renderDual.ts`). A floor has no coordinates: `resolveFloors(props, poses)` turns it into a `bar` at y = 0 spanning the figure's extent just before layout and drawing, separately per panel. The validator ignores floors (the existing below-floor rule already is the floor) and checks a board as one segment plus posts.

**Tech Stack:** TypeScript, Vitest, `npm run doodles` (writes `public/doodles/*.svg` and `src/data/generated/doodleMap.ts`), `npm run doodles:cards` (review PNGs).

## Global Constraints

- Work only in `/Users/alexei/Documents/calistenics/.worktrees/202-board-floor-props` (branch `feature/202-board-floor-props`, from `origin/dev`). Never use `git stash`. PR into `dev`.
- Every SVG for a spec without a floor or a board stays byte-identical. Checked by diffing all of `public/doodles/` against a snapshot taken before Task 1.
- Floors stay opt-in: never add a floor to a spec that has none.
- Do not edit exercise descriptions or anything under `data/`.
- Batch spec files import only from `./rig` or other batch/helper modules, never `./specs`.
- Finish every task with `npm run -s doodles`, `npx tsc --noEmit`, `npm run -s lint`, `npx vitest run` all passing.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Snapshot (do once, before Task 1):**

```bash
cd /Users/alexei/Documents/calistenics/.worktrees/202-board-floor-props
SNAP=/private/tmp/claude-503/-Users-alexei-Documents-calistenics--worktrees-pulse-lost-grace/fad277ac-6258-454d-b3af-ce95fda43e1d/scratchpad/202-before
npm run -s doodles && rm -rf $SNAP && mkdir -p $SNAP && cp -R public/doodles $SNAP/ && cp src/data/generated/doodleMap.ts $SNAP/
```

Compare after a task: `npm run -s doodles && diff -rq $SNAP/doodles public/doodles` — the only files listed may be the ones the task names.

---

### Task 1: `board` prop

**Files:**
- Modify: `src/doodles/rig.ts` (the `Prop` union, ~line 110)
- Modify: `src/doodles/renderSvg.ts` (`propSegments`, ~line 96)
- Modify: `src/doodles/renderDual.ts` (`frontProps` and the heuristic, ~lines 46–92)
- Modify: `src/doodles/validate.ts` (`DUAL_PROPS`, ~line 380, and its error text)
- Modify: `src/doodles/specsBatchAD.ts` (delete `slopedBench` ~line 326–346; `wger_1889` ~line 486)
- Modify: `src/doodles/specsBatchAK.ts` (import line 4; `wger_171` ~line 281)
- Test: `tests/doodles/dualView.test.ts` (replace the two "front-view props" tests ~lines 140–151)

**Interfaces:**
- Produces: `Prop` member `{ kind: "board"; from: Point; to: Point; posts?: boolean }`; exported constants `BOARD_POST_INSET = 16` (renderSvg.ts) and `BOARD_HALF = 36` (renderDual.ts).

- [ ] **Step 1: Write the failing tests** — replace the `describe("front-view props", …)` block in `tests/doodles/dualView.test.ts` with:

```ts
describe("board prop", () => {
  const board: Prop = { kind: "board", from: [-100, -50], to: [100, -150] };

  it("draws the plank and a post 16 in from each end down to the floor", () => {
    expect(propSegments(board)).toEqual([
      [[-100, -50], [100, -150]],
      [[-84, -58], [-84, 0]],
      [[84, -142], [84, 0]],
    ]);
    expect(propSegments({ ...board, posts: false })).toEqual([[[-100, -50], [100, -150]]]);
  });

  it("is seen end-on from the front: its outline plus a leg at each edge", () => {
    expect(frontProps([board], 100)).toEqual([
      { kind: "box", x: 64, y: -150, w: 72, h: 100 },
      { kind: "box", x: 64, y: -50, w: 0, h: 50 },
      { kind: "box", x: 136, y: -50, w: 0, h: 50 },
    ]);
  });

  it("is allowed in two views and checked as one obstacle", () => {
    const spec: DoodleSpec = { ...RAISE, props: [{ kind: "board", from: [-150, -60], to: [-60, -60], posts: false }] };
    expect(dualViewGuards(spec)).toEqual([]);
  });
});
```

Add `propSegments` to the `renderSvg` import at the top of the test file.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/doodles/dualView.test.ts`
Expected: FAIL — TypeScript/vitest error on `kind: "board"` not assignable to `Prop`, or wrong segments.

- [ ] **Step 3: Add the type** — in `src/doodles/rig.ts` add to the `Prop` union:

```ts
  /** A straight sloped plank from `from` to `to`; `posts` (default true) stand 16 in from each end down to the floor. */
  | { kind: "board"; from: Point; to: Point; posts?: boolean }
```

- [ ] **Step 4: Side drawing** — in `src/doodles/renderSvg.ts`, above `propSegments`:

```ts
/** A board's posts stand this far in from each end. */
export const BOARD_POST_INSET = 16;

/** Point on the board's line at `x`. */
function onBoard(from: Point, to: Point, x: number): Point {
  return [x, from[1] + ((to[1] - from[1]) * (x - from[0])) / (to[0] - from[0])];
}
```

and add a case to the `propSegments` switch:

```ts
    case "board": {
      const plank: [Point, Point] = [prop.from, prop.to];
      if (prop.posts === false) return [plank];
      const step = Math.sign(prop.to[0] - prop.from[0]) * BOARD_POST_INSET;
      const posts = [prop.from[0] + step, prop.to[0] - step].map((x): [Point, Point] => {
        const top = onBoard(prop.from, prop.to, x);
        return [top, [x, 0]];
      });
      return [plank, ...posts];
    }
```

`propSvg` and `propPoints` already draw any prop from its segments; no change. If coordinates print with long decimals, round the post tops with `Math.round(v * 10) / 10` (keep the test values consistent).

- [ ] **Step 5: Front drawing** — in `src/doodles/renderDual.ts`, delete `BOARD_GAP`, `POST_WIDTH`, `boardRuns`, `frontBars` and the `Bar` run logic, export `BOARD_HALF`, and replace `frontProps` with:

```ts
/** Half-width of a bench board (and its legs) seen end-on. */
export const BOARD_HALF = 36;

/** A board seen end-on: its outline from its highest to its lowest point, and a leg at each edge. */
function frontBoard(board: Extract<Prop, { kind: "board" }>, shift: number): Prop[] {
  const top = Math.min(board.from[1], board.to[1]);
  const bottom = Math.max(board.from[1], board.to[1]);
  const outline: Prop = { kind: "box", x: shift - BOARD_HALF, y: top, w: 2 * BOARD_HALF, h: bottom - top };
  if (board.posts === false) return [outline];
  const legs = [shift - BOARD_HALF, shift + BOARD_HALF].map((x): Prop => ({ kind: "box", x, y: bottom, w: 0, h: -bottom }));
  return [outline, ...legs];
}

/** All props as seen from the front (dualViewGuards admits only the kinds handled here). */
export function frontProps(props: readonly Prop[], shift = 0): Prop[] {
  return props.flatMap((prop): Prop[] => {
    switch (prop.kind) {
      case "bar":
        return [frontBar(prop, shift)];
      case "box":
        return [frontBox(prop, shift)];
      case "board":
        return frontBoard(prop, shift);
      default:
        return [];
    }
  });
}
```

Note the order change: props now come out in spec order (bars were previously first). Only `wger_171` has a bar and a board, so only its SVG can change because of this.

- [ ] **Step 6: Allow it in two views** — in `src/doodles/validate.ts`:

```ts
const DUAL_PROPS = new Set<Prop["kind"]>(["bar", "box", "board"]);
```

and update the error text to `(bar, box and board only)`. `obstacles()` and `headInProp()` need no change: they read `propSegments`, so a board is checked as one plank plus its posts.

- [ ] **Step 7: Migrate the two specs**
  - `src/doodles/specsBatchAD.ts`: delete `slopedBench` and its doc comment; `wger_1889` becomes `props: [{ kind: "board", from: DECLINE_HIGH, to: DECLINE_LOW }],`. Drop `Prop` from the import if now unused.
  - `src/doodles/specsBatchAK.ts`: remove the `slopedBench` import; `wger_171` becomes `props: [{ kind: "board", from: INCLINE_LOW, to: INCLINE_HIGH }, { kind: "bar", y: ROLLER[1], x1: ROLLER[0], x2: ROLLER[0], grips: [ROLLER[0]] }],`.

- [ ] **Step 8: Run tests and the snapshot diff**

Run: `npx vitest run tests/doodles && npm run -s doodles && diff -rq $SNAP/doodles public/doodles`
Expected: tests PASS; doodles generate with no errors; the diff lists only `doodle-decline-bench-leg-raise.svg` and `doodle-incline-crunches.svg`. If `npm run doodles` reports a crossing or head-in-prop on these two, adjust the pose against the single plank (it used to be ~85 strokes with 4-unit gaps) — do not loosen the validator.

- [ ] **Step 9: Look at them**

Run: `npm run -s doodles:cards -- /private/tmp/claude-503/-Users-alexei-Documents-calistenics--worktrees-pulse-lost-grace/fad277ac-6258-454d-b3af-ce95fda43e1d/scratchpad/202-cards-board wger_1889 wger_171`
Read both PNGs, every frame: one clean plank, posts to the floor, front view an outline plus two legs, body resting on the board (not floating above or sunk into it).

- [ ] **Step 10: Commit**

```bash
git add -A src/doodles tests/doodles public/doodles src/data/generated
git commit -m "feat(doodles): board prop replaces sloped-bench strokes (#202)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `floor` prop

**Files:**
- Modify: `src/doodles/rig.ts` (`Prop` union)
- Modify: `src/doodles/renderSvg.ts` (`propSegments`, new `resolveFloors`, `layoutFor`, `renderDoodleSvg`)
- Modify: `src/doodles/renderDual.ts` (`frontProps`, `dualLayout`, `renderDualSvg`)
- Modify: `src/doodles/validate.ts` (`obstacles`, `DUAL_PROPS`)
- Modify (migration): `src/doodles/specsWarmup.ts:59` (`SIDE_LYING_FLOOR`), `specsBatchE.ts:81` (`calfFloor`), `specsBatchH.ts:132`, `specsBatchI.ts:45`, `specsBatchX.ts:39`, `specsBatchAH.ts:30` (local `floor()` helpers), `specsBatchY.ts:589` (inline bar), and every call site listed by `grep -n "floor(\|calfFloor(\|SIDE_LYING_FLOOR\|kind: \"bar\", y: 0" src/doodles/specs*.ts` (about 30)
- Test: `tests/doodles/dualView.test.ts` (new `describe("floor prop")`)

**Interfaces:**
- Consumes: `frontProps(props, shift)` from Task 1.
- Produces: `Prop` member `{ kind: "floor" }`; `export const FLOOR_MARGIN = 30;` and `export function resolveFloors(props: readonly Prop[], poses: Solved[], dx = 0): Prop[]` in `renderSvg.ts`.

- [ ] **Step 1: Write the failing tests** — add to `tests/doodles/dualView.test.ts` (import `resolveFloors`, `FLOOR_MARGIN`, `renderDoodleSvg` and `solvePose` as needed):

```ts
describe("floor prop", () => {
  const stand = solvePose(STAND);

  it("becomes a line at y = 0 spanning the figure plus the margin", () => {
    const xs = figurePoints(stand).map((p) => p.point[0]);
    const [floor] = resolveFloors([{ kind: "floor" }], [stand]);
    expect(floor).toEqual({
      kind: "bar",
      y: 0,
      x1: Math.floor(Math.min(...xs) - FLOOR_MARGIN),
      x2: Math.ceil(Math.max(...xs) + FLOOR_MARGIN),
    });
  });

  it("reaches under props that stand on the floor", () => {
    const [, floor] = resolveFloors([{ kind: "box", x: 200, y: -40, w: 60, h: 40 }, { kind: "floor" }], [stand]);
    expect(floor).toMatchObject({ kind: "bar", y: 0, x2: 260 + FLOOR_MARGIN });
  });

  it("leaves other props alone and draws nothing without a floor", () => {
    const bar: Prop = { kind: "bar", y: -200, x1: -50, x2: 50 };
    expect(resolveFloors([bar], [stand])).toEqual([bar]);
  });

  it("sizes each panel's floor to that panel in two views", () => {
    const spec: DoodleSpec = { ...RAISE, props: [{ kind: "floor" }] };
    expect(dualViewGuards(spec)).toEqual([]);
    expect(validateSpec(spec).errors).toEqual([]);
    const svg = renderDoodleSvg(spec);
    expect(svg.match(/<line x1="[^"]+" y1="0"/g)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/doodles/dualView.test.ts`
Expected: FAIL — `resolveFloors` is not exported / `kind: "floor"` not assignable to `Prop`.

- [ ] **Step 3: Type and segments** — `src/doodles/rig.ts`, add to `Prop`:

```ts
  /** The ground line at y = 0, sized by the renderer to the figure (and props on the floor) over the loop. */
  | { kind: "floor" }
```

In `renderSvg.ts` `propSegments`, add `case "floor": return [];` (an unresolved floor draws and blocks nothing).

- [ ] **Step 4: `resolveFloors`** — in `src/doodles/renderSvg.ts`, below `propPoints`:

```ts
/** How far a floor line runs past the figure (and props on the floor) at each end. */
export const FLOOR_MARGIN = 30;

/**
 * Props ready to draw: each `floor` becomes a line at y = 0 under everything
 * the figure reaches over the loop, plus any prop standing on the floor.
 */
export function resolveFloors(props: readonly Prop[], poses: Solved[], dx = 0): Prop[] {
  if (!props.some((prop) => prop.kind === "floor")) return [...props];
  const xs = [
    // `dx` moves the figure as the panel is drawn (the front panel sits right of the side panel).
    ...poses.flatMap((pose) => figurePoints(pose).map((p) => p.point[0] + dx)),
    ...props.flatMap(propPoints).filter(([, y]) => Math.abs(y) < 1).map(([x]) => x),
  ];
  const x1 = Math.floor(Math.min(...xs) - FLOOR_MARGIN);
  const x2 = Math.ceil(Math.max(...xs) + FLOOR_MARGIN);
  return props.map((prop): Prop => (prop.kind === "floor" ? { kind: "bar", y: 0, x1, x2 } : prop));
}
```

- [ ] **Step 5: Use it in the one-view renderer** — in `renderSvg.ts`:
  - `layoutFor(spec, poses)`: `const figure = figureExtent(poses, resolveFloors(spec.props ?? [], poses), spec.wheel);`
  - `renderDoodleSvg`: `const props = resolveFloors(spec.props ?? [], poses).map(propSvg).join("");`

A spec without a floor gets its props array back unchanged, so its SVG is identical.

- [ ] **Step 6: Use it per panel in two views** — in `renderDual.ts`:
  - `frontProps`: add `case "floor": return [prop];` (the floor passes through and is resolved against the front poses).
  - `dualLayout`: `const sideProps = resolveFloors(props, side);` `const frontPanel = resolveFloors(frontProps(props), front);` then `figureExtent(side, sideProps, spec.wheel)` and `figureExtent(front, frontPanel, spec.wheel)`.
  - `renderDualSvg`: side panel draws `resolveFloors(props, layout.side).map(propSvg)`; front panel draws `resolveFloors(frontProps(props, layout.frontShift), layout.front, layout.frontShift).map(propSvg)`. `frontProps(…, shift)` already moves bars, boxes and boards right by the shift, and the `dx` argument (Step 4) moves the figure's x the same way, so the floor is measured in the same, shifted coordinates.

- [ ] **Step 7: Validator** — in `validate.ts`: `obstacles(prop)` returns `[]` for `prop.kind === "floor"` (already true via `propSegments`, but make it explicit with a comment: "the floor is the below-floor rule"), and `DUAL_PROPS` becomes `["bar", "box", "board", "floor"]` with the error text `(bar, box, board and floor only)`.

- [ ] **Step 8: Run the new tests**

Run: `npx vitest run tests/doodles`
Expected: PASS.

- [ ] **Step 9: Migrate every hand-sized floor** — replace each floor bar with `{ kind: "floor" }` and delete the helpers:
  - `specsWarmup.ts:59`: `export const SIDE_LYING_FLOOR: Prop = { kind: "floor" };` (keep the export: B, O, AF, AG import it) — or replace its uses with `{ kind: "floor" }` and delete it; either is fine, keep one form throughout.
  - `specsBatchE.ts:81`: delete `calfFloor`; `calfFloor(170)` / `calfFloor(100)` → `{ kind: "floor" }`.
  - `specsBatchH.ts:132`, `specsBatchI.ts:45`, `specsBatchX.ts:39`, `specsBatchAH.ts:30`: delete the local `floor` helper; every `floor(a, b)` → `{ kind: "floor" }`.
  - `specsBatchY.ts:589`: `{ kind: "bar", y: 0, x1: -200, x2: 200 }` → `{ kind: "floor" }`.
  - Re-run the grep from **Files**; it must list nothing but imports of `SIDE_LYING_FLOOR` (if kept).

- [ ] **Step 10: Snapshot diff**

Run: `npm run -s doodles && diff -rq $SNAP/doodles public/doodles`
Expected: only the ~30 floor specs (plus Task 1's two) differ. For each listed file, confirm the change is only the floor `<line … y1="0" … y2="0"/>` width and, where the floor got wider or narrower, the viewBox/rect. Any other difference is a bug.

- [ ] **Step 11: Look at them** — render cards for every floor spec id (`grep -B8 "kind: \"floor\"" src/doodles/specs*.ts | grep "id:"` lists them; pass ids via a file and `xargs`, zsh does not word-split `$VAR`). Read every PNG: the floor runs under the whole movement (jumps and travel included), no figure part below it, not absurdly long.

- [ ] **Step 12: Commit**

```bash
git add -A src/doodles tests/doodles public/doodles src/data/generated
git commit -m "feat(doodles): floor prop sized by the renderer replaces hand-sized floor bars (#202)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Docs, independent review, PR

**Files:**
- Modify: `docs/doodles-authoring.md` (Conventions "Props:" line ~27 and the two-view props bullet ~line 38)

- [ ] **Step 1: Docs** — Conventions: `- Props: bar, box, board (sloped plank: \`{ kind: "board", from, to, posts? }\`), floor (\`{ kind: "floor" }\`, sized by the renderer; opt-in), parallelBars, parallettes, plus an optional \`band\` between the thighs. …` (keep the rest of the line). Two views bullet: `- Props in two views: \`bar\`, \`box\`, \`board\` and \`floor\`. A box is 120 wide from the front; \`frontHalf\` narrows it (…). A board is seen end-on as its outline with two legs; each panel sizes its own floor. No \`mirror\` …` — delete the `slopedBench` sentence.

- [ ] **Step 2: Full checks**

Run: `npm run -s doodles && npx tsc --noEmit && npm run -s lint && npx vitest run`
Expected: no doodle errors; all pass.

- [ ] **Step 3: Independent judge** — dispatch a read-only reviewer with the "Prompt: independent review" from `docs/doodles-authoring.md` on the changed ids (cards from Tasks 1–2), asking specifically: does each floor sit under the whole movement; does each board read as one plank with the body resting on it; KEEP or FIX per id. Apply any FIX, re-render, re-check.

- [ ] **Step 4: Commit, push, PR**

```bash
git add -A && git commit -m "docs(doodles): board and floor props in the authoring guide (#202)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feature/202-board-floor-props
gh pr create --base dev --title "Doodles: board and floor props (#202)" --body "Closes #202 …"
```

PR body: what changed, the list of changed doodles (2 boards, ~30 floors), confirmation that every other SVG is byte-identical, judge verdicts, checks run; end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge unless asked.
