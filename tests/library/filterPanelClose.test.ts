/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { mountLibraryList, type ListActions } from "../../src/library/libraryList";
import type { FilterPanelId } from "../../src/library/filterPanels";

function actions(over: Partial<ListActions> = {}): ListActions {
  return {
    onSearch: vi.fn(),
    onLevel: vi.fn(),
    onArea: vi.fn(),
    onMuscle: vi.fn(),
    onStretch: vi.fn(),
    onSelect: vi.fn(),
    onForJoints: vi.fn(),
    onOnlyGear: vi.fn(),
    onPanelToggle: vi.fn(),
    onClearFilters: vi.fn(),
    onExcludedOnly: vi.fn(),
    ...over,
  };
}

function filterPanel(root: ParentNode, panel: FilterPanelId): HTMLDetailsElement | null {
  return root.querySelector<HTMLDetailsElement>(`details[data-panel="${panel}"]`);
}

/** Search text and chip selections the close button must not change. */
function expectSquatBeginnerLowerFilters(root: ParentNode): void {
  expect(root.querySelector<HTMLInputElement>("[data-search]")?.value).toBe("squat");
  expect(root.querySelector('[data-level="beginner"]')?.getAttribute("aria-pressed")).toBe("true");
  expect(root.querySelector('[data-area="lower"]')?.getAttribute("aria-pressed")).toBe("true");
}

describe("filter panel close", () => {
  it("closes the open sheet without clearing filters or search", () => {
    const root = document.createElement("div");
    const onPanelToggle = vi.fn();
    mountLibraryList(root, {
      results: [],
      targetIds: new Set(),
      query: {
        text: "squat",
        level: "beginner",
        area: "lower",
        openPanels: ["body"],
      },
      actions: actions({ onPanelToggle }),
    });

    const details = filterPanel(root, "body");
    expect(details?.open).toBe(true);
    expectSquatBeginnerLowerFilters(root);

    details?.querySelector<HTMLButtonElement>("[data-close-filters]")?.click();

    expect(details?.open).toBe(false);
    expect(onPanelToggle).toHaveBeenCalledWith("body", false);
    expectSquatBeginnerLowerFilters(root);
  });
});
