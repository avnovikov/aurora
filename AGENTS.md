# Agent workflow (Aurora)

This file is the Cursor/Codex-facing twin of `CLAUDE.md`. Same rules apply.

## Mandatory for feature work

1. **GitHub issue first** — create or use an existing issue before coding.
2. **Git worktree always** — implement under `.worktrees/<slug>/` from `origin/poc` (or agreed base). Do not pile feature edits onto the primary checkout.
3. **Branch naming** — `feature/<issue>-kebab-slug` or `bug/<issue>-kebab-slug`.
4. **PR to `poc`** — reference the issue in the PR body.

## Why

Isolation keeps `poc` / the main tree usable while features land; issues give a durable acceptance trail for review and merge.
