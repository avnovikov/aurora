# Rest Banter + Countdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voiced rests speak mid-rest banter when >30s, Get ready at 10s left, and count 5→1 (no count when `timedNext`).

**Architecture:** Extend pure `cueSchedule` in `restCue.ts`; add `rest_banter` lines; filter banter out of on-screen `restCueText`; bake Piper northern WAVs.

**Tech Stack:** TypeScript, Vitest, Piper `en_GB-northern_english_male-medium`.

**Spec:** `docs/superpowers/specs/2026-11-17-rest-banter-countdown-design.md`  
**Issue:** https://github.com/avnovikov/aurora/issues/96  
**Branch / worktree:** `feature/96-rest-banter-countdown` @ `.worktrees/rest-banter`

## Global Constraints

- Banter voice-only (`restCueText` skips `rest_banter`).
- Get ready @ 10 when rest ≥ 10; count includes `five` unless `timedNext`.
- Mid-banter only when `remainingSeconds > 30` at `ceil(remainingSeconds / 2)`.
- Piper northern for new assets; keep `lines.ts` and `prebuild-voice.sh` in sync.
- Also bake missing `set_pace_nudge` / `_b` / `_c` already listed in `lines.ts` so `voicePack.test.ts` passes.

---

### Task 1: Schedule + tests (TDD)

**Files:**
- Modify: `tests/voice/restCue.test.ts`
- Modify: `src/voice/restCue.ts`
- Modify: `src/voice/lines.ts` (add `rest_banter` id + variants so schedule can pick them)
- Test: `tests/voice/restCue.test.ts`

**Interfaces:**
- Produces: `RestCueKind` includes `"rest_banter"`; `cueSchedule` events as in spec table.

- [ ] **Step 1: Rewrite failing tests** in `tests/voice/restCue.test.ts` to match spec (90s banter@45 + ready@10 + 5–1 + go; 30s no banter; 8s/3s short; timedNext; validation).

- [ ] **Step 2: Run** `npx vitest run tests/voice/restCue.test.ts` — expect FAIL.

- [ ] **Step 3: Implement** `rest_banter` in `lines.ts` and new `cueSchedule` logic in `restCue.ts`.

- [ ] **Step 4: Run** same tests — expect PASS.

- [ ] **Step 5: Commit** `feat(#96): rest cue schedule — banter, ready@10, count from 5`

---

### Task 2: On-screen filter

**Files:**
- Modify: `src/ui/sessionRest.ts` (`restCueText`)
- Modify: `tests/ui/sessionRestCue.test.ts`

- [ ] **Step 1: Add test** that a `rest_banter` event at matching seconds returns `null` from `restCueText`.

- [ ] **Step 2: Run** `npx vitest run tests/ui/sessionRestCue.test.ts` — expect FAIL.

- [ ] **Step 3: Skip** `kind === "rest_banter"` in `restCueText`.

- [ ] **Step 4: Run** — expect PASS.

- [ ] **Step 5: Commit** `fix(#96): keep rest banter off the on-screen cue`

---

### Task 3: Piper assets + voice pack

**Files:**
- Modify: `scripts/prebuild-voice.sh` (add four `rest_banter*` + three `set_pace_nudge*`)
- Generate: `public/voice/rest_banter*.wav`, `public/voice/set_pace_nudge*.wav`
- Update: `data/voice-manifest.tsv` (via bake script)

- [ ] **Step 1: Add bake_line entries** matching `lines.ts` text exactly.

- [ ] **Step 2: Run bake** (from worktree, with `.voice-train` linked):

```bash
AURORA_PIPER_BIN="$PWD/.voice-train/venv/bin/piper" \
AURORA_PIPER_MODEL="$PWD/.voice-train/models/en_GB-northern_english_male-medium.onnx" \
bash scripts/prebuild-voice.sh
```

- [ ] **Step 3: Run** `npx vitest run tests/voice/voicePack.test.ts tests/voice/restCue.test.ts tests/ui/sessionRestCue.test.ts` — expect PASS.

- [ ] **Step 4: Commit** `feat(#96): bake rest_banter (and missing set_pace_nudge) WAVs`

---

### Task 4: Full verify

- [ ] **Step 1: Run** `npx vitest run` — expect all PASS (or note pre-existing failures unrelated to this change).

- [ ] **Step 2: Commit docs** if not already: spec + this plan `docs(#96): rest banter countdown spec and plan`.
