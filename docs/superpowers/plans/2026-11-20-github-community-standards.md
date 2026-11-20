# Plan: GitHub community standards (#226)

> **For agentic workers:** complete tasks in order; each task is one coherent docs change.

**Goal:** Land CoC, Contributing, issue templates, and a minimal PR-template sign-off so GitHub community health is complete and Aurora’s contribution rules are explicit.

**Tech note:** Documentation only — no app code, no CI changes.

---

### Task 1: Design + CoC

**Files:**
- Create: `docs/superpowers/specs/2026-11-20-github-community-standards-design.md`
- Create: `CODE_OF_CONDUCT.md`

- [ ] Spec matches brainstorm decisions
- [ ] Covenant 2.1 with `alexei.128.946@gmail.com` as enforcement contact

### Task 2: Contributing

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] Workflow: issue → worktree → PR to `dev`
- [ ] Gates: CodeQL, smell/clean-code, tests/build
- [ ] Privacy / no unrelated installs
- [ ] Named contributor + `Signed-off-by:`
- [ ] AI policy; links to `SECURITY.md`, CoC, `docs/development.md`

### Task 3: Issue + PR templates; README

**Files:**
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_idea.yml`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `README.md`

- [ ] Security contact link present
- [ ] Bug + Feature/idea forms
- [ ] PR template has use-case + Signed-off-by
- [ ] README Develop links Contributing and CoC
