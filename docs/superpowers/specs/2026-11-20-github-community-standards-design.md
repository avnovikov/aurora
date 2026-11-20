# GitHub community standards (CoC, Contributing, issue templates)

**Date:** 2026-11-20  
**GitHub:** [#226](https://github.com/avnovikov/aurora/issues/226)  
**Branch:** `feature/226-github-community-standards` (from `origin/dev`, PR to `dev`)

## Goal

Raise Aurora’s GitHub community health from ~71% to full checklist coverage, while documenting the real hybrid workflow for humans and agents: issue first, worktree from `origin/dev`, PR to `dev`, quality gates, local-only privacy, and HotSpot-style named-contributor sign-off.

## Decisions

| Topic | Choice |
|-------|--------|
| Audience | Hybrid — public welcome + agent/human workflow as one source of truth |
| Responsibility | Governance + DCO-style attestation (`Signed-off-by:`); named contributor owns use-case / reason / idea (not a legal liability transfer) |
| Code of Conduct | Contributor Covenant 2.1; enforcement email matches `SECURITY.md` |
| Issue templates | `config.yml` contact links (security → Advisories) + Bug + Feature/idea |
| PR template | Minimal add: use-case/reason/idea + `Signed-off-by:`; keep Summary / Base / Test plan |
| Approach | HotSpot-inspired hybrid (not a full SSDF port) |

## Files

| Path | Responsibility |
|------|----------------|
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 |
| `CONTRIBUTING.md` | Policy: workflow, gates, privacy/scope, sign-off, AI, links |
| `.github/ISSUE_TEMPLATE/config.yml` | Security contact link; template chooser |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Structured bug form |
| `.github/ISSUE_TEMPLATE/feature_idea.yml` | Feature/idea with named contributor + use-case/reason/idea |
| `.github/PULL_REQUEST_TEMPLATE.md` | Existing fields + use-case + sign-off |
| `README.md` | Link Contributing (+ CoC) under Develop |

`docs/development.md` remains the how-to-run guide; Contributing points to it.

## Hard gates (documented in Contributing)

- CI must pass: tests, `npm run smell` (clean-code / complexity), CodeQL / security workflow
- Must not exfiltrate on-device training/health data or add outbound telemetry
- Must not install or ship anything unrelated to Aurora
- A named person states the use-case / reason / idea; they steward the change via `Signed-off-by:`

## Out of scope

- CLA
- Enforcing SSH commit signing in branch protection (may follow later)
- Changing CI itself

## Acceptance

Matches issue #226 acceptance criteria; community profile shows CoC, Contributing, and issue templates present.
