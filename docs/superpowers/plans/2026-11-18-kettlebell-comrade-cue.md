# Kettlebell “comrade” cue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On kettlebell work + the following rest, ~20% of covered coach picks use phonetic `kahm-rahd` “comrade” variants (same Piper northern male).

**Architecture:** `kettlebellOnly` + optional `bakeText` on `CoachLine`; `pickLine` filters and applies a 0.2 comrade gate; session sets a small coach KB context flag for work and the rest after; bake script uses `bakeText ?? text`.

**Tech Stack:** TypeScript, Vitest, Piper WAV pack (`scripts/prebuild-voice.sh`).

**Issue / branch:** #172 · `feature/172-kettlebell-comrade` from/to `dev`.

## Global Constraints

- Same Piper model `en_GB-northern_english_male-medium.onnx`
- Phonetic bake: ASCII `kahm-rahd`
- Gate: `/\bkettlebells?\b/i` on exercise name (dumbbell-only out)
- PR targets `dev`

---

### Task 1: Kettlebell exercise helper

**Files:**
- Create: `src/voice/kettlebellExercise.ts`
- Test: `tests/voice/kettlebellExercise.test.ts`

- [ ] **Step 1:** Failing tests for name match / non-match
- [ ] **Step 2:** Implement `isKettlebellExercise({ name: string }): boolean`
- [ ] **Step 3:** Pass tests

### Task 2: pickLine context + comrade variants

**Files:**
- Modify: `src/voice/lines.ts`
- Create: `src/voice/coachContext.ts`
- Test: `tests/voice/comradeLines.test.ts`
- Modify: `tests/voice/voicePack.test.ts` (`bakeText ?? text`)
- Modify: `src/voice/holdCue.ts` (use `pickLine` with effort)
- Modify: `src/voice/restCue.ts` (pass-through via pickLine + context)

- [ ] **Step 1:** `setKettlebellCoachContext` / `getKettlebellCoachContext`
- [ ] **Step 2:** Extend `CoachLine` with `kettlebellOnly?`, `bakeText?`; add twins; `COMRADE_PICK_CHANCE = 0.2`
- [ ] **Step 3:** `pickLine(id, random, options?)` filters + 20% gate
- [ ] **Step 4:** Tests: no KB → never comrade; KB + seeded random → ~20%
- [ ] **Step 5:** holdCue uses pickLine

### Task 3: Session + coachVoice wiring

**Files:**
- Modify: `src/voice/coachVoice.ts`
- Modify: `src/ui/sessionView.ts`, `sessionRest.ts`, `sessionControls.ts`, `sessionWarmup.ts` as needed

- [ ] **Step 1:** Set KB context from current / just-finished work around speak + rest start
- [ ] **Step 2:** Rest go-on / extend use `pickLine` so twins can fire
- [ ] **Step 3:** Warmup station: set context from station title/name when speaking change_side / hold cues

### Task 4: Bake WAVs

**Files:**
- Modify: `scripts/prebuild-voice.sh`
- Modify: `data/voice-manifest.tsv`
- Add: `public/voice/*comrade*.wav` (and rest twins)

- [ ] **Step 1:** Bake new keys with `AURORA_PIPER_BIN` / model from repo `.voice-train`
- [ ] **Step 2:** `voicePack` + focused vitest green

---
