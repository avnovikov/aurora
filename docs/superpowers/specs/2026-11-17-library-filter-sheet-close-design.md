# Library filter sheet close (#82)

**Status:** Approved for planning  
**Date:** 2026-11-17  
**Issue:** https://github.com/avnovikov/aurora/issues/82

## Problem

Library filter panels (`Show`, `Area & muscle`, `Level`) open as bottom sheets from `<details>` triggers in the dock. The only dismiss path is tapping the same summary again (or opening another panel). Once the sheet covers the list, that affordance is easy to miss.

## Goals

- Give every open filter sheet explicit chrome: a header and a close control.
- Closing must collapse the panel, keep current filter values, and leave search text alone.
- Close control is keyboard-accessible and named (`aria-label="Close filters"`).
- Keep one-panel-at-a-time behaviour (`name="lib-filter"`).

## Non-goals

- Scrim / dimming the exercise list behind the sheet.
- A Done footer button (or both × and Done).
- Renaming or redesigning the three dock triggers.
- Changing chip layout or filter semantics.
- Shipping the same chrome on Plan in this issue (shared markup later is fine if cheap).

## Design decisions

| Decision | Choice |
|----------|--------|
| Chrome style | Sheet header (title + close), not a bare × floating on chips |
| Header title | Generic **Filters** for every panel (not the panel name or current value) |
| Title look | Dock-matched label: uppercase, muted, letter-spacing like `.t-label` |
| Close control | × only (quiet muted icon), top-right of the header |
| Backdrop | None — list stays fully visible and interactive under the sheet |
| Scope | Library first |

## Visual structure

```
┌─────────────────────────────┐
│ FILTERS                  ×  │  ← header row; thin edge below
├─────────────────────────────┤
│ [chips / toggles…]          │  ← existing sheet body
└─────────────────────────────┘
│ Show │ Area & muscle │ Level│  ← dock; open trigger keeps strong border
```

Reference mockup direction: **B · Dock-matched label** (brainstorm screenshots under `.superpowers/brainstorm/…/shots/`).

## Behaviour

1. Opening a panel shows the sheet with the new header.
2. Activating × closes that panel (equivalent to collapsing `<details>` / clearing it from `openPanels`).
3. Tapping the open summary still toggles as today.
4. Opening another panel still closes the previous one via shared `name="lib-filter"`.
5. × never clears filters or search.

## Implementation sketch

- **Markup:** `src/library/filterPanels.ts` — inside `.lib-sheet`, prepend a header block (title + close button with `data-close-filters` or similar).
- **Styles:** `src/styles/library.css` — header flex row, `.t-label`-aligned title, quiet × (min 44×44 hit target).
- **Wire-up:** `src/ui/libraryView.ts` (or existing panel open/close handlers) — click on close collapses the open panel without resetting `FilterValues`.
- Prefer native `<details>` collapse where possible; if a button inside the sheet does not toggle summary cleanly, call the same open-panel state path used today.

## Acceptance

- [ ] Open any Library filter → header shows FILTERS and × without hunting
- [ ] × closes the sheet; filters remain applied; search unchanged
- [ ] One panel at a time still works
- [ ] Close is reachable by keyboard and has an accessible name
- [ ] Unit/UI test covers close without clearing filters

## Testing notes

- Extend `tests/library/filterPanels.test.ts` (markup includes close control).
- Add or extend a Library UI test: open panel → click close → panel closed, filter values unchanged.
