# Claude / agent workflow (Aurora)

## Always: issue + worktree

Before implementing a **new feature** or **non-trivial fix**:

1. **Create a GitHub issue first** (`gh issue create`) with a short summary and acceptance criteria. Link any design spec under `docs/superpowers/specs/`.
2. **Implement only in a git worktree** under `.worktrees/` (already gitignored), not on the primary checkout.
   - Branch from up-to-date `origin/mvp` (or the agreed base).
   - Prefer: `.worktrees/<issue-or-branch-slug>/`
   - Example: `git worktree add .worktrees/93-rep-set-duration -b feature/93-rep-set-duration origin/mvp`
3. Name branches with the issue number when one exists: `feature/<n>-short-slug` or `bug/<n>-short-slug`.
4. Open the PR against `mvp` and reference the issue (`Closes #n` or `Fixes #n` when appropriate).

Do **not** mix unrelated WIP on the main working tree while a feature is in flight. Keep the primary checkout on a stable branch (`main` / idle) when possible.

## Specs before large builds

For creative or multi-step product work, follow the project brainstorming → design doc → plan → implement path. Specs live in `docs/superpowers/specs/`; plans in `docs/superpowers/plans/`.

## Tests

Run the relevant Vitest files before claiming done. Prefer focused tests that match the acceptance criteria on the issue.
