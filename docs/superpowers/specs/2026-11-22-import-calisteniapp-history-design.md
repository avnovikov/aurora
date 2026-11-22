# Import Calisteniapp history

Issue #291. Status: agreed with the athlete on 2026-11-22.

## Goal

Bring the athlete's Calisteniapp sessions into Aurora's history, so that History, Body and the levels reflect training done before Aurora.

## Source

`calisteniapp-history.json`, read off the phone over USB (Profile → Activity → session details). Each session has a title, a relative date ("8 days ago") with an estimated date, the summary (duration, energy, tonnage, effort), and per exercise the target ("5 sets · 12 reps · 12.0 kg") and every set's result ("12 reps" or `20"`), weight and effort. A GDPR export from Calisteniapp can replace this file later; the importer reads the same shape.

## Decisions

| Question | Decision |
|---|---|
| Exercise mapping | Reviewed table `src/data/import/calisteniappMap.ts`. Unmapped or `null` names are skipped and listed. |
| Weighted sets | Go to the move's curated `weightedId` twin, the same swap as the session's Add weight. A move without a twin keeps its id; the load is lost. |
| Holds | A hold result (seconds) only goes to an isometric move and a rep result only to a non-isometric one. A mismatched set is skipped. Seconds go in `completedReps`, as live holds do. |
| Isometric single-leg hamstring bridge | Skipped (no honest match). |
| History cap | Raised from 200 to 1000 entries. Imported entries carry no pulse series, so each is small. |
| Levels | Imported sets count. They are replayed oldest first through the live path (`recordBestReps` per set, then `applySetLogToMemory`) into a separate memory map, each stamped with the session's date, so `lastSessionAt`, the 21-day inferred TTL and the 42-day retest flag age from when the training happened. That map is then merged into the live memories per exercise: a move with no live row takes the imported row; a move with a live row keeps it (counts, caps, inferred tier, newest `lastSessionAt`) and only takes the higher `bestReps` and `loggedTier`. Old sessions never reset newer stall counts or dates. |
| Decay | Before an imported result feeds `recordBestReps`, it is scaled by the Body detraining curve `sessionAgeWeight(age)`: full credit to 14 days, 85% at 49 days, then exponential. Rounded down to whole reps or seconds. History keeps the real numbers. |
| Plan | Imported sessions do not advance the plan queue or change the schedule. |
| Duplicates | Each imported entry carries `source: { app: "calisteniapp", key }`, key = estimated date + title. A key already in history is not imported again. |

## Mapping a session to a history entry

- `completedAt`: the estimated date at 12:00 UTC.
- `templateId`: `import:calisteniapp`. `templateName`: the Calisteniapp title.
- `evaluation`: Calisteniapp effort Easy → easy, Moderate → on target, Hard → difficult, Very hard → wiped; anything else → on target.
- `sets`: one record per mapped set. `prescribedReps` is the target's number (the low end of a range such as 18–20). `completedReps` is the result. `stopReason` is `completed`. `loggedAt` equals `completedAt`.
- `setCount` and `exerciseIds` follow from the mapped sets. A session with no mapped sets is skipped.

## On the phone

No import screen for now (decided 2026-11-22). A local build bundles the athlete's file from the git-ignored `src/data/private/calisteniapp-history.json`. At start-up `applyBundledImport` merges any session whose key is not yet in `aurora.poc.importedSessions.v1`, then records the keys. Builds without the file do nothing. A Settings import screen can reuse `applyCalisteniappImport` later.

## Dates

Calisteniapp shows relative dates. Sessions are listed newest first. "N days ago" gives the date directly. Coarser labels ("about a month ago", "3 months ago") give a range, and the sessions inside one label are spread evenly across it, newest first, at least a day apart. Every date is an estimate; a GDPR export with exact timestamps can replace them.

## Tests

Mapping, result parsing, weighted twin, hold/rep mismatch, decay scaling, dedupe on re-import, cap, chronological replay, and the Settings preview text.
