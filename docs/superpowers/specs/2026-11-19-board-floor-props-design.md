# Board and floor props for doodles

Issue: #202. Follow-up from #175 (dual-view doodles, design `2026-11-18-dual-view-doodles-design.md`).

## Problem

Two kinds of scenery are faked with `bar` props, and the renderer has to guess what the author meant.

- **Floors.** About 30 specs in 11 batch files draw a floor as a flat `bar` at y = 0 whose width is picked by eye (`floor()` helpers in batches H, I, X and AH; `calfFloor` in E; `SIDE_LYING_FLOOR` in the warm-up specs; a few inline `y: 0` bars). In two-view doodles the front panel draws every bar at a fixed ±90, so the floor has nothing to do with where the feet are.
- **Sloped benches.** `slopedBench` (batch AD) draws a sloped board as about 85 short bar strokes plus two 1-unit-wide boxes as posts. Seen from the front, `renderDual.ts` guesses that three or more bars close in height are a board (`boardRuns`, `frontBars`, `BOARD_GAP`) and that any box 2 units wide or less is a pair of bench legs (`POST_WIDTH`). The validator checks every stroke as a separate obstacle. Used by decline bench leg raise (AD, one view) and incline crunches (AK, two views).

## Design

### `floor` prop

`{ kind: "floor" }`, with no coordinates. Floors stay opt-in: a spec without one gets no line.

- The renderer draws one line at y = 0. It spans the widest x extent, over every sample of the loop, of the figure (all joints and the head) and of any other prop that touches y = 0, plus a margin of 30 at each end.
- In a two-view doodle each panel computes its own extent, so the front panel's floor fits the front-view figure.
- The validator needs nothing new: the existing rule (no joint below y = 0) already is the floor. A `floor` prop is not an obstacle for crossings or head-in-prop checks.
- Bounds (`propPoints`) use the computed extent, so the viewBox fits the line.

### `board` prop

`{ kind: "board"; from: Point; to: Point; posts?: boolean }` — a straight plank from `from` to `to`. `posts` defaults to `true`.

- **Side view:** one line from `from` to `to`. With posts, a vertical line from the board to the floor at 16 in from each end (the inset `slopedBench` uses now).
- **Front view:** the board seen end-on — a rectangle ±36 wide from the board's highest point down to its lowest (as the heuristic draws today), and with posts, a leg at each edge (±36) down to the floor.
- **Validator:** the board is one segment (plus the posts) for crossings and head-in-prop, replacing about 85 strokes.
- Two-view props: `bar`, `box`, `board`, `floor`.

### Migration

- Replace every hand-sized floor bar with `{ kind: "floor" }` and delete the local helpers.
- Replace `slopedBench(a, b)` with `{ kind: "board", from: a, to: b }` and delete `slopedBench`.
- Delete `boardRuns`, `frontBars`, `BOARD_GAP` and `POST_WIDTH` from `renderDual.ts`; `frontProps` becomes a plain map over props.
- `docs/doodles-authoring.md`: list the two new props and drop the `slopedBench` note.

## Visible change

- Specs with a floor: only the floor line's width changes.
- Decline bench leg raise and incline crunches: the board draws as one clean line instead of strokes; front view looks as before.
- Every other SVG is byte-identical. This is checked by diffing all generated SVGs against a snapshot taken before the change.

## Tests

- `floor`: the line spans the figure's extent plus the margin, per panel; no line when the spec has no floor.
- `board`: side segments and posts; front outline and legs; the validator reports a crossing against the board as one segment.
- Regression: byte-identical SVGs for everything without a floor or a board (existing `sameDrawing` test plus the snapshot diff).
- Review cards for every changed doodle, checked by an independent judge (KEEP/FIX).

## Out of scope

The sideways-aware solver; floors added to doodles that have none; other new prop kinds.
