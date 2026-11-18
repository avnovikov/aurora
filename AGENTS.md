# Agent workflow (Aurora)

This file is the Cursor/Codex-facing twin of `CLAUDE.md`. Same rules apply.

## Mandatory for feature work

1. **GitHub issue first** — create or use an existing issue before coding.
2. **Git worktree always** — implement under `.worktrees/<slug>/` from `origin/dev` (or agreed base). Do not pile feature edits onto the primary checkout.
3. **Branch naming** — `feature/<issue>-kebab-slug` or `bug/<issue>-kebab-slug`.
4. **PR to `dev`** — reference the issue in the PR body.

## Branch roles

- **`dev`** — day-to-day integration for feature and bug merges.
- **`mvp`** / **`release/**`** — release branches (promote from `dev`).
- **`main`** — published release; merge only with an explicit release.

## Why

Isolation keeps `dev` / release lines / the main tree usable while features land; issues give a durable acceptance trail for review and merge.
