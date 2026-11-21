# Rest go-on only in easy + cue height latch

## Goal

Propose skipping rest (“Want to go on?”) only when the live pulse is in the lowest band (**easy**). Keep rest-expiry recovery as today (**easy** or **steady**). After go-on has been shown, keep one empty row under the cue so Get ready / count do not collapse the layout.

## Decisions

- Go-on offer: **easy only** (still once per rest; still blocked in the Get ready window).
- Rest expiry: **easy** or **steady** end without +30; **work / hard / max** still add another 30 seconds.
- Cue height: latch two-line `min-height` on `[data-rest-cue]` **only after** go-on has been painted this rest; clear when the rest timer ends.
- No copy, voice asset, swipe-skip, or zone-boundary changes.

## Behaviour

| Situation | Today | After |
|-----------|--------|--------|
| Zone `easy`, above Get ready, not yet asked | Offer go-on | Offer go-on |
| Zone `steady`, above Get ready, not yet asked | Offer go-on | No offer |
| Zone `work` / `hard` / `max` | No offer | No offer |
| Rest clock hits 0 in `easy` or `steady` | End rest | End rest |
| Rest clock hits 0 in hotter zones | +30 extend | +30 extend |
| Go-on never shown this rest | One-line cue min-height | Unchanged |
| Go-on shown, then replaced by Get ready / count / go | Cue shrinks to one line | Two-line min-height kept (count + empty row) |

## Modules

- `src/ui/restPulse.ts` — `shouldOfferRestedGoOn` true only for `easy`; `shouldAddRest` still false for `easy` and `steady`.
- `src/ui/sessionRest.ts` — when setting `heldCue` to go-on, mark the cue element (class or `data-*`); clear the mark on `finish` / `clear`.
- `src/styles/session.css` — latched state uses `min-height` of two cue lines (match existing `line-height: 24px` → 48px).
- `tests/ui/restPulse.test.ts` — steady no longer offers; easy still offers; add-rest cases unchanged.
- `tests/ui/sessionRestPulse.test.ts` — steady no longer paints go-on; after go-on then end-cluster, cue keeps the latch attribute/class.

## Test contract (examples)

- `shouldOfferRestedGoOn({ zone: "easy", … })` → true; `{ zone: "steady", … }` → false.
- `shouldAddRest("steady")` → false; `shouldAddRest("work")` → true.
- Rest timer with `readZone: () => "steady"` never paints or speaks `REST_GO_ON`.
- Rest timer with `readZone: () => "easy"` paints go-on once; cue element carries the height latch.
- After go-on, when schedule cue text is a single-line count, latch remains until `finish` / `clear`.

## Out of scope

- Changing when swipe can skip rest.
- Rewording go-on / extend lines or regenerating WAVs.
- Offering go-on again after a +30 extension (still one ask per rest, including extensions).
- Reserving two-line height when go-on never appeared.
