# Endura + coaching standards calibration

**Date:** 2026-11-19  
**Issue:** #189  
**Status:** Approved for implementation

## Goal

Replace inflated or generic novice→elite rep/hold bands with **Endura men 20–29** wherever Aurora has a twin, apply **+20%** for support-assisted variants, and set **coaching-composite** bands for remaining seed-plan work moves that lack Endura pages. Progress screen and dose logic then reflect realistic intermediate/advanced bars (e.g. free split squat intermediate **15**, advanced **28**).

## Non-goals

- Sex/age-aware tables in-app (no athlete demographics yet)
- Endura mapping for band-as-load accessories or pure mobility
- Changing progress UI layout (bars only)

## Tier mapping

Endura publishes Novice / Intermediate / Advanced / Elite (below Novice = Beginner). Aurora has five floors:

| Aurora | Source |
|--------|--------|
| `beginner` | Endura Novice |
| `intermediate` | Endura Intermediate |
| `advanced` | Endura Advanced |
| `elite` | Endura Elite |
| `novice` | `max(1, round(0.67 × Endura Novice))` |

**Assisted rule:** when the move is support/balance-assisted and Endura only publishes the free parent, use `ceil(parentTier × 1.2)` per tier.  
**Precedence:** an exact Endura page for the variation beats the +20% rule (e.g. Incline Push-Up).  
**Harder variant without a page:** parent ÷ 1.2 (e.g. elevated pike ← floor pike).

Reference demographic: **men age 20–29** (matches product examples such as split 15 / 28).

## Library: Endura matches

Apply to every catalogue row whose name matches an Endura bodyweight calculator (push-up family variants, dips, pull/chin variants, muscle-ups, BW squat, split squat, Bulgarian, pistol, Nordic, calf raise, glute bridge / single-leg glute bridge when present, forearm plank, pike, HSPU, incline/decline/diamond/etc.).

Source attribution in code: `Endura men 20–29` + calculator name.

## Assisted (+20%) examples

| Assisted | Parent |
|----------|--------|
| Supported Split Squat | Split Squat |
| Assisted pistol | Pistol |
| Wall Push-Up | Push-Up |
| Bench / chair / floor dips | Parallel-bar Dip |

## Plan work moves without Endura (coaching composite)

No single peer-reviewed dataset covers these; label as **coaching composite** with per-exercise notes:

| Exercise | Nov / Beg / Int / Adv / Eli | Notes |
|----------|------------------------------|-------|
| Hollow hold (s) | 10 / 20 / 45 / 60 / 90 | Gravity + hollow coaching tables |
| Dead hang (s) | 15 / 30 / 60 / 90 / 120 | Bodyweight coaching standards |
| Hanging knee raise | 3 / 8 / 12 / 15 / 20 | Skill-tree entry ~10; programming 8–15 |
| Dead bug (reps/side) | 4 / 8 / 12 / 16 / 20 | PT/programming ranges |
| Wall handstand (s) | 10 / 20 / 30 / 60 / 90 | 30s chest-to-wall entry; 60s extended |
| Freestanding HS (s) | 2 / 5 / 10 / 30 / 60 | FIG 2s; coaching 10→30s |
| Scapular push-up | 5 / 10 / 15 / 20 / 30 | PT 3×10–15 |
| Scapular pull-up | 3 / 6 / 10 / 15 / 20 | Activation/pull prep |
| Hip hinge | 5 / 10 / 15 / 20 / 30 | Patterning, not max test |
| Elevated pike | ceil(floor pike ÷ 1.2) → 5 / 6 / 15 / 30 / 49 | Harder than Endura floor pike |

## Architecture

1. `src/data/enrich/enduraStandards.ts` — Endura men 20–29 tables + name matchers + assisted/harder helpers.  
2. `src/data/enrich/standards.ts` — try Endura / assisted / coaching overrides before generic difficulty templates.  
3. `src/data/seed.ts` `SEED_STANDARDS` — align seed work moves with the same numbers so seed wins stay consistent.  
4. Tests assert key ladders and that Supported Split Squat is ceil(split × 1.2).

## Out of scope leftovers

Generic difficulty templates remain for unmatched catalogue rows (shrimp, hollow rocks variants, most mobility, band accessories, etc.) until a better source exists.
