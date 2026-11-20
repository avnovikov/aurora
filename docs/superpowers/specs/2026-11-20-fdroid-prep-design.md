# F-Droid prep (official repo)

**Date:** 2026-11-20  
**GitHub:** [#229](https://github.com/avnovikov/aurora/issues/229)  
**Branch:** `feature/229-fdroid-prep` → PR to `dev`

## Goal

Make Aurora ready for an official F-Droid `fdroiddata` MR after IzzyOnDroid rejection (LLM-assisted code policy).

## Decisions

| Topic | Choice |
|-------|--------|
| Store | Official F-Droid (not Izzy) |
| Signing (v1) | F-Droid signs; reproducible own-key later |
| Process | Prep in Aurora first; maintainer opens GitLab MR |
| GMS | Remove unused Capacitor `google-services` wiring |

## Deliverables

- Strip `google-services` classpath / conditional apply
- `docs/distribution/fdroid.md` — checklist + policy notes
- `docs/distribution/fdroid-metadata-com.aurora.alvorada.yml` — draft build recipe

## Out of scope

- Opening the GitLab MR
- Reproducible builds / `AllowedAPKSigningKeys`
