# Library filter sheet close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dock-matched FILTERS header + quiet × to Library filter sheets so an open panel can be dismissed without hunting for the summary (#82).

**Architecture:** Prepend sheet chrome in `filterPanels.ts`; style in `library.css`; wire close in `libraryList.ts` by collapsing the parent `<details>` and syncing `onPanelToggle(panel, false)` without clearing filters.

**Tech Stack:** TypeScript, Vitest, existing Library `<details name="lib-filter">` panels.

## Global Constraints

- Header title is always **Filters** (CSS uppercase via `.t-label`), not the panel name.
- Close is × only with `aria-label="Close filters"`.
- Closing must not clear filters or search; no scrim.
- Library only (Plan out of scope).

---

### Task 1: Sheet header markup + unit tests

**Files:**
- Modify: `src/library/filterPanels.ts`
- Modify: `tests/library/filterPanels.test.ts`

**Interfaces:**
- Produces: each `.lib-sheet` starts with a header containing `.t-label` “Filters” and `button[data-close-filters]` with accessible name.

- [ ] **Step 1: Write failing tests** — every panel sheet includes FILTERS header + `data-close-filters` with `aria-label="Close filters"`; open panel still opens.
- [ ] **Step 2: Run tests — expect fail**
- [ ] **Step 3: Implement `panelHtml` header inside `.lib-sheet`**
- [ ] **Step 4: Run tests — expect pass**
- [ ] **Step 5: Commit**

### Task 2: Styles for dock-matched header

**Files:**
- Modify: `src/styles/library.css`

- [ ] **Step 1: Add `.lib-sheet-hdr` flex row, quiet muted ×, min 44×44 hit target, edge under header**
- [ ] **Step 2: Visual sanity via existing Library CSS tokens (no new colors)**
- [ ] **Step 3: Commit**

### Task 3: Wire close without clearing filters

**Files:**
- Modify: `src/library/libraryList.ts`
- Create: `tests/library/filterPanelClose.test.ts` (happy-dom)

**Interfaces:**
- Consumes: `actions.onPanelToggle(panel, open)`
- Produces: click on `[data-close-filters]` sets parent `details.open = false` and calls `onPanelToggle(id, false)`.

- [ ] **Step 1: Write failing UI test** — open panel HTML mounted, click ×, details closed, filter chip pressed state unchanged, search input value unchanged if present.
- [ ] **Step 2: Run test — expect fail**
- [ ] **Step 3: Wire click handler in `mountLibraryList`**
- [ ] **Step 4: Run tests — expect pass**
- [ ] **Step 5: Commit**

### Task 4: Verify suite + finish

- [ ] **Step 1: `npm test` full suite**
- [ ] **Step 2: `npx tsc --noEmit`**
- [ ] **Step 3: Finish branch (PR when asked)**
