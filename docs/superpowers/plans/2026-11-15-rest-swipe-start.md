# Rest swipe to start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Rest / Get ready, swipe right ends the wait and shows the next work set; left cancels.

**Architecture:** Extend `decideSwipeRelease` / `wireSwipe` with `commitDirections: "both" | "right"`. Rest stage gets `data-swipe-stage`; controls call a new `onEndRestEarly` that clears the rest timer and paints work.

**Tech Stack:** TypeScript, Vitest, existing session UI.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-15-rest-swipe-start-design.md`
- British English UI copy
- Do not change work swipe (both directions still finish)
- No new Start button

## File map

| Path | Responsibility |
|------|----------------|
| `src/ui/sessionSwipe.ts` | `commitDirections` on decide + wire |
| `src/ui/sessionChalk.ts` | Rest stage swipe hook + hint |
| `src/ui/sessionControls.ts` | Wire rest vs work swipe callbacks |
| `src/ui/sessionView.ts` | `onEndRestEarly` clears timer → work |
| `tests/ui/sessionSwipe.test.ts` | Right-only release decisions |
| `tests/ui/sessionTransition.test.ts` or chalk | Hint / stage markup on rest |

---

### Task 1: Right-only swipe decisions (TDD)

**Files:** `tests/ui/sessionSwipe.test.ts`, `src/ui/sessionSwipe.ts`

- [x] Failing tests: with `commitDirections: "right"`, left threshold/flick cancel; right still commits; default `"both"` unchanged
- [x] Implement in `decideSwipeRelease` + pass option through `wireSwipe`
- [x] `npm test -- tests/ui/sessionSwipe.test.ts` green

### Task 2: Rest markup + control wiring

**Files:** `sessionChalk.ts`, `sessionControls.ts`, `sessionView.ts`, transition/chalk tests

- [x] Rest HTML: `data-swipe-stage`, hint “Swipe right to start”
- [x] `onEndRestEarly` handler; rest wires `commitDirections: "right"`
- [x] Full suite green
