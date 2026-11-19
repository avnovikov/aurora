# Endura Standards Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calibrate Aurora exercise tier standards from Endura men 20–29 (+20% assisted) and coaching composites for remaining plan work moves (#189).

**Architecture:** Add `enduraStandards.ts` with tables + name matchers; prefer those in `standardsFor` before family/generic templates; align `SEED_STANDARDS` so seed rows match.

**Tech Stack:** TypeScript, Vitest, existing enrich pipeline.

## Global Constraints

- Reference: Endura men age 20–29
- Aurora mapping: beginner=N, intermediate=I, advanced=A, elite=E; novice=max(1, round(0.67×N))
- Assisted: ceil(parent × 1.2); harder without page: parent ÷ 1.2
- Exact Endura page beats +20% rule
- Closes #189

---

### Task 1: Endura table module + matcher tests

**Files:**
- Create: `src/data/enrich/enduraStandards.ts`
- Create: `tests/data/enduraStandards.test.ts`

- [ ] Write failing tests for split 15/28, supported ceil×1.2, pull-up floors, incline exact table
- [ ] Implement `fromEndura`, `scaleStandards`, `enduraStandardsFor(name, effort)`
- [ ] Run tests; pass

### Task 2: Wire into enrich + seed

**Files:**
- Modify: `src/data/enrich/standards.ts`
- Modify: `src/data/seed.ts` (`SEED_STANDARDS`)
- Modify: `tests/data/enrichCatalogue.test.ts` (plank / SL glute / pistol expectations)

- [ ] Call `enduraStandardsFor` first in `standardsFor`
- [ ] Update SPECIFIC rows displaced by Endura (plank, nordic, SL glute, bilateral calf, BW squat via name match)
- [ ] Align seed standards for plan work moves
- [ ] Update enrichCatalogue assertions
- [ ] Run focused Vitest

### Task 3: Spec already written

**Files:**
- `docs/superpowers/specs/2026-11-19-endura-standards-calibration-design.md` (done)
