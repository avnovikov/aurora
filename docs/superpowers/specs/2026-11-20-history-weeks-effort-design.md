# History: weeks and effort — design

Issue #228. Signed-off design mock: [2026-11-20-history-weeks-effort-mock.html](2026-11-20-history-weeks-effort-mock.html) (Desk Studio job 20261120-1136-history-tab-experiments; Creative Director 8.5, proof passes in Rassvet and Alvorada). The mock uses the DESIGN.md role names; the app uses `--on-accent` / `--control-edge`.

Redesign the History tab around **weeks and effort**, from the signed-off Desk Studio design (job `20261120-1136-history-tab-experiments`, final at `.desk/out/20261120-1136-history-tab-experiments/final.html`; spec `docs/superpowers/specs/2026-11-20-history-weeks-effort-design.md`).

## What changes
- **Header:** `History` heading plus a one-line lede, "6 sessions in 3 weeks". The eyebrow and "Sessions" title go.
- **Effort key, once:** Easy · On target · Difficult · Wiped, drawn as 1–4 filled steps.
- **Week groups,** Monday start:
  - "w/c 17 Nov · this week" and a large session count. The current week's count is the only accent on the screen.
  - A Mon–Sun strip: each training day shows its effort as a 4-step bar. Tapping it opens and scrolls to that session. Day labels of training days are bright and rest days muted.
- **Sessions as cards** (`<details>`), newest open by default:
  - Title "Wed 19 Nov · 18:10", sub-line "Upper body · B" (+ " · strap worn" when a strap was used), effort word on the right.
  - Exercise rows: name, reps per set "6 / 6 / 6", meta "avg 134 bpm · PB 15" ("PB 15" alone without a strap), chevron.
  - A row opens the exercise page; Back returns to History.
- **Personal best, not a comparison** (user change, 2026-11-20; replaces the mock's "was a / b / c" and "Compared with …" line): each row shows "PB n", where n = max(`ExerciseMemory.bestReps`, the highest stored completedReps for that exercise in history), since bestReps can lag or be missing; omitted when neither exists. When this session's highest set beats every set stored for that exercise in earlier sessions, the meta shows **"new PB"** instead (font-weight 600, foreground, not accent). No earlier stored sets means no "new PB" claim. Nothing is invented.
- **Older summary-only sessions** show "15 sets logged" in the sub-line and the exercise names without reps. The "Some rows are session summaries" banner goes.
- **Empty state:** "History is empty until the first finished session."

## Unchanged
- Plan code (A/B) kept.
- No warm-up/cool-down rows.
- No per-row target.
- Exercise/pattern filter chip (from Progress) kept.
- Library detail history list untouched.
- Tab bar untouched.

## Removed
- The raw bpm sample list under a session (`data-pulse-series`), replaced by "strap worn". Per-exercise averages stay.

## Acceptance criteria
- [ ] Sessions grouped by Monday-start week, newest week first, with count + Mon–Sun effort strip (local time).
- [ ] Effort bar level: easy 1, on_target 2, difficult 3, wiped 4; several sessions on one day show the hardest.
- [ ] Accent colour used only on the current week's count.
- [ ] Rows show "PB n" from `bestReps` (absent when none); "new PB" only when the session's top set beats every earlier stored set for that exercise, never on a first-ever session.
- [ ] Legacy sessions show "N sets logged", no reps and no PB marks.
- [ ] Exercise rows open the exercise page; Back returns to History (#219 behaviour intact).
- [ ] Targets ≥ 44px; works in all six palettes (role tokens only).
- [ ] Focused Vitest for the week/effort/comparison model and the view; tsc, smell and the suite pass.


## Model decisions
- Week = Monday 00:00 local to Sunday; label `w/c <d MMM>`; ` · this week` when it contains today.
- Lede: `<n> session(s) in <w> week(s)`, w = number of week groups shown.
- Effort level: easy 1, on_target 2, difficult 3, wiped 4. A day with several sessions shows the highest level; tapping opens the newest session that day.
- PB: `personalBests` (exercise id → `bestReps`) is injected into the model (the view loads it with `loadMemories()`) and merged with the best stored set per exercise across history. "new PB" = max(this session's sets) > max(all sets for that exercise in older non-legacy sessions), and only when such sets exist. Legacy sessions get no PB marks. No previous-session comparison is built.
- Newest session card open on first render; the rest closed.
