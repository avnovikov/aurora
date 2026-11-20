# Contributing to Aurora · Rassvet

Thank you for helping improve Aurora. This guide is for people and for agents working in this repository. Product orientation lives in the [README](README.md); how to run and test locally lives in [docs/development.md](docs/development.md).

## Code of Conduct

Participation is governed by the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Named contributor owns the idea

Every change needs a **named person** who states the **use-case / reason / idea**. Agents may implement; a person must stand behind *why* the change exists.

That named contributor **stewards** the change: they are accountable in project governance for the intent and for affirming the rules below. This is not a transfer of end-user legal liability (see [docs/TERMS.md](docs/TERMS.md) and the MIT licence).

## Before you code

1. **Open or use a GitHub issue** with a short summary, acceptance criteria, and the use-case / reason / idea under a named contributor.
2. **Implement in a git worktree** under `.worktrees/<slug>/`, branched from up-to-date `origin/dev`. Do not pile feature work onto the primary checkout.
3. **Name the branch** `feature/<issue>-kebab-slug` or `bug/<issue>-kebab-slug`.
4. **Open the PR against `dev`** and reference the issue (`Closes #n` / `Fixes #n` when appropriate).

Release promotions use `mvp` / `release/**` / `main` — not day-to-day feature PRs.

## Quality gates (must pass)

Before merge, the change must pass the project’s automated and local checks:

| Gate | What to run / expect |
|------|----------------------|
| Tests | `npm test` (and UI tests when CI requires them) |
| Clean-code / smell | `npm run smell` (ESLint + SonarJS; `--max-warnings 0`) |
| Build | `npm run build` |
| Security / CodeQL | `.github/workflows/security.yml` (CodeQL and related scans on the PR) |

A failing smell or security check blocks merge the same way a failing test does.

## Privacy and scope

Aurora is **local-first**. Training and health signals stay on the device in 0.1 (see [docs/PRIVACY.md](docs/PRIVACY.md) and [SECURITY.md](SECURITY.md)).

Contributions must **not**:

- Exfiltrate or sync training/health/profile data to external services, apps, or analytics
- Add telemetry, crash reporters, or SDKs that send personal or health-related data off-device
- Install, vendor, or ship anything **unrelated** to building or running Aurora

New dependencies need a clear reason tied to the use-case and must fit the local-first posture.

## Pull requests and sign-off

Every PR must include:

1. **Summary** of what changed
2. **Use-case / reason / idea** and the **named contributor**
3. **Base branch** note (`dev` for feature/bug work)
4. **Test plan** checklist
5. A HotSpot-style attestation line:

```text
Signed-off-by: Your Name <you@example.com>
```

By adding `Signed-off-by:`, the named contributor attests that:

- They own the stated use-case / reason / idea for this change
- The change respects privacy/scope and quality gates above
- They have the right to submit the work under the project’s MIT licence

Maintainer review/approval is still required before merge.

## Use of AI

AI tools (including coding agents) are welcome.

- **A named person still owns** the use-case / reason / idea and the `Signed-off-by:` line
- AI-generated code must meet the same tests, smell, CodeQL, and privacy rules as human-written code
- Do not add AI-suggested dependencies that violate privacy/scope or are unrelated to Aurora

## Security vulnerabilities

Do **not** open public issues for security reports. Follow [SECURITY.md](SECURITY.md) (GitHub Security Advisories or the listed email).

## Document control

| Attribute | Value |
|-----------|-------|
| Related | `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/development.md`, `docs/PRIVACY.md` |
| Approved by | @avnovikov |
