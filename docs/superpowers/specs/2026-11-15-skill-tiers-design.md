# Skill tiers & fast progression

**Date:** 2026-11-15  
**Status:** Approved (option C — declare + refine from logs)

## Goal

Know how well the athlete can do each exercise (novice → elite), set starting reps/holds from published standards, and raise complexity or reps almost immediately when performance proves a higher tier.

## Model

- **Tiers:** `novice | beginner | intermediate | advanced | elite`
- **Exercise.standards:** max clean reps (or hold seconds) at each tier
- **ExerciseMemory:** `skillTier`, optional `declaredTier`, `bestReps`
- Declare in Library; logged sets update `bestReps` and may promote `skillTier`

## Resolver

1. Scale slot dose toward `standards[tier] − targetRir`
2. Advance to `harderId` when: two sessions at standard **or** tier is advanced/elite **or** `bestReps ≥ standards.advanced` **or** (`bestReps ≥ intermediate` and ≥1 session at standard)

## UI

- Library detail: tier picker + standards strip
- Progress / Today reasons mention tier when dose or progression changes
