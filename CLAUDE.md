# Claude / agent workflow (Aurora)

## Always: issue + worktree

Before implementing a **new feature** or **non-trivial fix**:

1. **Create a GitHub issue first** (`gh issue create`) with a short summary and acceptance criteria. Link any design spec under `docs/superpowers/specs/`.
2. **Implement only in a git worktree** under `.worktrees/` (already gitignored), not on the primary checkout.
   - Branch from up-to-date `origin/dev` (or the agreed base).
   - Prefer: `.worktrees/<issue-or-branch-slug>/`
   - Example: `git worktree add .worktrees/93-rep-set-duration -b feature/93-rep-set-duration origin/dev`
3. Name branches with the issue number when one exists: `feature/<n>-short-slug` or `bug/<n>-short-slug`.
4. Open the PR against **`dev`** and reference the issue (`Closes #n` or `Fixes #n` when appropriate).

Do **not** mix unrelated WIP on the main working tree while a feature is in flight. Keep the primary checkout on a stable branch (`main` / idle) when possible.

## Branch roles

- **`dev`** — day-to-day integration. All feature/bug PRs target `dev`.
- **`mvp`**, **`release/**`** — release lines. Promote from `dev` when cutting a release candidate.
- **`main`** — published release / default branch. Merge only as part of an explicit release.

## Specs before large builds

For creative or multi-step product work, follow the project brainstorming → design doc → plan → implement path. Specs live in `docs/superpowers/specs/`; plans in `docs/superpowers/plans/`.

## Tests

Run the relevant Vitest files before claiming done. Prefer focused tests that match the acceptance criteria on the issue.
