# GDPR / CCPA·CPRA privacy docs (v0.1)

**Issue:** #155  
**Date:** 2026-11-18  
**Scope:** Public documentation only (verbiage). No in-app UX, consent flows, or code.

## Goal

Split privacy from terms and add a terse GDPR + CCPA/CPRA checklist grounded in Aurora’s local-only v0.1 posture (no cloud account, no server sync of training/health data).

## Decisions

- Public docs only (not an internal compliance programme).
- `docs/TERMS.md` + new `docs/PRIVACY.md`; README links both.
- Structured checklist style; keep copy terse.
- Short note that GitHub Releases / Obtainium / Issues are third-party surfaces with their own policies.

## Document layout

| File | Role |
|------|------|
| `docs/TERMS.md` | Product terms; short pointer to Privacy for data details |
| `docs/PRIVACY.md` | On-device inventory; GDPR / CCPA·CPRA checklist; distribution note; delete-by-uninstall |
| `README.md` | Separate Terms and Privacy links; privacy blurb points to Privacy |

## Privacy checklist (content)

1. Scope (v0.1 APK / local preview)
2. On-device data inventory
3. What we do not do (no account, sync, sale/share, ads/analytics SDK, remote HR upload)
4. GDPR framing (no remote personal-data processing by Aurora → most hosted-controller duties N/A; delete via uninstall/clear storage)
5. CCPA / CPRA framing (no sell/share; no remote categories collected by Aurora)
6. GitHub / Obtainium note
7. On-device security (AuroraSecure / Keystore); device control is user’s responsibility
8. Changes (future sync/accounts update this doc first)

## Out of scope

- Attorney review / formal legal opinion
- In-app privacy screen or consent UI
- Data export/portability features
- Analytics, crash reporting, or accounts

## Non-goals / disclaimer

Docs describe product behaviour. They are not legal advice.
