# First-run onboarding: Settings → Target → Plan

Date: 2026-11-16
Branch: `feature/first-run-onboarding`

## Goal

On a new installation the athlete lands in a short workflow: configure Settings, optionally pick a first training area, then open Plan. The plan starts empty; choosing an area builds the first block. Skip leaves Plan empty.

## Decisions

| Question | Decision |
|---|---|
| Flow | Settings (no app tab bar) → Target (areas only, Skip) → Plan |
| Settings UI | Reuse the redesigned tabbed Settings (You / Gear / Training / App) |
| First-run Settings extras | Primary **Continue**; hide Backup export and Deload |
| Target choices | Area chips only: Upper, Lower, Core, Full body (same labels as Plan). No skills yet (list empty / program-driven later) |
| Choose area | `addBlockToPlan` into an empty queue, then open Plan |
| Skip | Persist empty queue, open Plan |
| Joint history | Only in Settings (You). Remove standalone `setupView` |
| `setupDone` | Set true when Target finishes (choose or Skip), not on Settings Continue |
| Later launches | Normal shell; landing stays Today once setup is done |
| Empty plan | First-class: load/save allow `items: []`. Onboarding start writes empty. Explicit empty stays empty. Legacy: `setupDone` and missing key still get the old seed default once |

## Empty plan behaviour

- `savePlanQueue` accepts empty.
- Onboarding start calls `beginOnboardingQueue()` so a new install never keeps the seed programme.
- `loadPlanQueue`: missing/invalid key → empty when `!setupDone`; seed default when `setupDone` (legacy). Explicit `{ items: [] }` stays empty.
- Completing the last day leaves empty (does not reseed).
- Removing the last day is allowed.
- Today with an empty queue (and no override): empty state pointing to Plan / Add days — no Start check-in.
- Plan with an empty queue: calm empty copy + open **Add days** (existing control).

## UI copy (voice: measured, not motivated)

**Settings step:** eyebrow `Setup`, heading `Your setup`, hint that changes save as you go, CTA `Continue`.

**Target step:** eyebrow `Setup`, heading `What to train first`, tagline that this shapes the first days (changeable on Plan), area chips, CTA `Start with this` (disabled until a chip is selected), secondary `Skip for now`.

## Architecture

| Unit | Does |
|---|---|
| `plan/queue.ts` | Empty-safe load/save/complete/remove |
| `ui/onboarding.ts` | Orchestrates Settings → Target → `onDone(tab)` |
| `ui/settingsView.ts` / `settingsPage.ts` | Optional setup mode (Continue, hide export/deload) |
| `ui/onboardingTarget.ts` | Target step HTML + wiring |
| `ui/setupView.ts` | Deleted; callers use onboarding |
| `ui/app.ts` | Boot into onboarding when `!setupDone`; finish on Plan |
| `ui/todayHome.ts` / `app.ts` | Empty-plan Today state |

## Out of scope

- Skill targets in the Target step
- Mobility / Joint care as first-target chips
- Changing post-setup default landing from Today
- Importing a backup during first-run

## Testing

- Queue: empty load before setup; legacy seed when setupDone + missing key; save empty; complete last → empty; remove last allowed
- Onboarding: Continue does not set `setupDone`; choose area writes block and sets `setupDone`; Skip writes empty and sets `setupDone`
- Settings setup mode: Continue present; export/deload absent
- Target: Start disabled until area selected; chips match `AREA_KINDS` labels
