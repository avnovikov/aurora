# Review: Aurora Plan screen, Not for me control

Standard: app screen (no Desk standard fits), scored on rubric + house style, DESIGN.md wins. Size: phone 390px.
Source (untouched): `.desk/out/20261115-2140-plan-screen-redesign/final-plex.html`. Fixed copy: `final.html` (fonts and doodles inlined, 455 KB).

## Scores

| | Hier. | Type | Space | Colour | Comp. | Orig. | Brand | Copy | Avg | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| Before | 7 | 7 | 7 | 9 | 6 | 6 | 7 | 8 | 7.1 | no |
| Round 1 | 8 | 8 | 7 | 9 | 7 | 7 | 8 | 8 | 7.8 | no |
| Round 2 (final) | 9 | 9 | 8 | 9 | 8 | 8 | 9 | 9 | 8.6 | yes |

## Notes (Art Director, applied in round 1; CD notes in round 2)

1. Row: `.plan-ex` grid `minmax(0,1fr) 116px`, gap 8; action column = Swap 64px + overflow 44px, identical in all 28 rows. Names get about 192px, so most fit on one line. Long names still wrap in the name column, and the action column stays aligned. (axis composition, spacing)
2. Not for me moved behind a per-row ⋯ button (44×44, muted, `aria-haspopup="menu"`). The menu hangs 4px below its trigger, has a controlEdge border and no shadow. The item reads "Not for me" with the helper "Keep this move out of all your sessions". (hierarchy, brand)
3. Choosing it replaces the row with "<exercise> is out of all your sessions." and an Undo button in the action column, at row height, with no timer. After Undo the status reads "<exercise> is back in your sessions." (brand: reversible, one-handed)
4. Today · Bulgarian split squat is expanded with its doodle in `figure.plan-ex-doodle`. The img has the viewBox's width and height, `width:100%;height:auto`, no max-height, object-fit, negative margin or overflow clip.
5. Round 2: undo row on the grid; Undo weight 400; one button-label size (12.8px); Then-day durations moved onto the title line; divider and 32px before MAKE THIS DAY; disabled Earlier drawn as an edge-bordered button; menu named by `aria-labelledby`.
6. Declined, with reasons: Remove onto the Move row (puts a destructive control where the thumb rests); Make this day chips as a grid (outside scope, part of the signed-off layout); CD's shorter helper copy (keeps the app's existing wording).
7. Final CD polish left open: align Then durations to x=308, Today card padding 24/24, rail dot level with the TODAY label.

## Accessibility (Accessibility Specialist)

- Fixed, 4.1.2 / 2.4.6 / 2.5.3: per-row names are unique and qualified by day, e.g. "Not for me: Bodyweight squat, Today", "Swap: …", "More options: …", "Undo: …". The duplicate in Then 5 adds its slot: "Hollow body hold (Hollow finish), Then 5". All 28 are unique.
- Fixed, 4.1.2 / 2.1.1 / 2.4.3: menu keyboard contract (Enter/Space/ArrowDown opens and focuses the item, arrows/Home/End, Escape returns focus, outside tap closes). Focus moves to Undo after the action and back to ⋯ after Undo. `role="status"` sits in the DOM empty before text is set.
- Fixed, 1.1.1: the doodle has alt text; the select updates src, width, height and alt together.
- Fixed, 1.4.4 / 1.4.10: chips use `height:auto; min-height:44px` instead of a fixed 44px.
- Open (out of scope): Remove has no undo (3.3.4); Make/Move group names repeat across days; "≈", "×", "s" and "·" are read literally (add sr-only text); summary DOM order for Today; tab bar uses buttons rather than links; a live region for day moves.
- Open: the six check-doodle alts were written from exercise names, not from reading each drawing.

## Copy (Copy Editor)

- "More for X" became "More options: X, <day>". The helper "Keeps…" became "Keep this move out of all your sessions" to match the app's imperative. The undo line, "Undo" and the dev label are unchanged.
- Recommended, not changed: "move" means both an exercise and reordering on this screen; the apostrophe in "night's"; "6 days" against "Three days"; split the Level note. Library data: "Single-Leg Romanian Deadlift" and "Sliding Leg Curl" are Title Case, and "Toward" is US spelling.

## Proof

Rounds 0–2: the only flag is 1.0:1 contrast on transparent-background buttons (Not for me and chips in round 0, Swap in rounds 1–2), the known false positive. The real colours pass in all palettes. Font check passes: Plex Sans + Plex Sans Condensed inlined, no Inter. Renders are in `.desk/jobs/20261115-2201-plan-not-for-me/renders/round-0|1|2/`, with `state-menu`, `state-undo`, `palette-*` and six doodle-check subfolders. The CD confirmed no limb or head is cut in any of the six doodles and that every palette is ok.
