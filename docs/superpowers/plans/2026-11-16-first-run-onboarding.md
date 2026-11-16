# First-run onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fresh installs run Settings → Target (area or Skip) → Plan, with an empty plan by default and the first area block built via existing `addBlockToPlan`.

**Architecture:** Empty-safe plan queue; replace `setupView` with an onboarding orchestrator that reuses setup-mode Settings and a new Target screen; boot finishes on Plan.

**Tech Stack:** Vanilla TypeScript, Vitest, existing Plan/Settings UI patterns.

## Global Constraints

- Copy: measured, not motivated; en-GB.
- Target areas only: `AREA_KINDS` (upper / lower / core / full). No skills.
- Reuse redesigned Settings tabs; hide export + deload in setup mode.
- Do not reseed `DEFAULT_PLAN_QUEUE` after the athlete empties the plan.

---

### Task 1: Empty-safe plan queue

**Files:**
- Modify: `src/plan/queue.ts`
- Test: `tests/plan/emptyQueue.test.ts`
- Depends on: `loadProfile().setupDone` for legacy missing-key behaviour

**Interfaces:**
- Produces: `loadPlanQueue()` may return `{ items: [] }`; `savePlanQueue` accepts empty; `completeNext` / `removeQueueItem` may leave empty

- [ ] **Step 1: Write failing tests** for empty before setup, legacy seed when setupDone + no key, save empty round-trip, complete last → empty, remove last allowed
- [ ] **Step 2: Implement** empty-safe queue rules
- [ ] **Step 3: Run tests** — pass
- [ ] **Step 4: Commit**

### Task 2: Settings setup mode

**Files:**
- Modify: `src/ui/settingsPage.ts`, `src/ui/settingsView.ts`
- Test: `tests/ui/settingsAndReview.test.ts` (extend)

**Interfaces:**
- Produces: `settingsPageHtml({ ..., setup?: boolean })`; `renderSettingsView(root, { onContinue?: () => void })`

- [ ] **Step 1: Tests** — setup HTML has Continue, no export/deload; normal still has export
- [ ] **Step 2: Implement** setup flag + wire Continue
- [ ] **Step 3: Pass tests + commit**

### Task 3: Target step + onboarding orchestrator

**Files:**
- Create: `src/ui/onboardingTarget.ts`, `src/ui/onboarding.ts`
- Delete: `src/ui/setupView.ts`
- Modify: `src/ui/app.ts`
- Test: `tests/ui/onboarding.test.ts`

**Interfaces:**
- Produces: `renderOnboarding(root, { onDone: (tab: AppTab) => void })`
- Choose area → `addBlockToPlan` + `savePlanQueue` + `setupDone`
- Skip → `savePlanQueue({ items: [] })` + `setupDone`
- `onDone("plan")`

- [ ] **Step 1: Failing tests** for Continue → Target, choose, Skip
- [ ] **Step 2: Implement** Target UI + orchestrator; wire `bootApp`
- [ ] **Step 3: Pass tests + commit**

### Task 4: Empty Plan / Today UI

**Files:**
- Modify: `src/ui/app.ts`, `src/ui/todayHome.ts`, `src/ui/planPage.ts` / `planModel.ts` as needed
- Test: `tests/ui/todayHome.test.ts`, `tests/plan/planPage.test.ts` (extend)

- [ ] **Step 1: Empty Today** — no Start; point to Plan
- [ ] **Step 2: Empty Plan** — calm empty + Add days available
- [ ] **Step 3: Pass tests + commit**

### Task 5: Spec/plan already written; final verification

- [ ] Run focused Vitest suites for queue, settings, onboarding, today/plan
- [ ] Commit any leftover docs if not already committed
