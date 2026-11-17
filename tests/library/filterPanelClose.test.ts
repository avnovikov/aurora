/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { filterPanelsHtml } from "../../src/library/filterPanels";
import { mountLibraryList, type ListActions } from "../../src/library/libraryList";
import { PANEL_STATE, SHOW_NONE } from "../helpers/libraryFilters";

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

    const details = root.querySelector<HTMLDetailsElement>('details[data-panel="body"]');
    expect(details?.open).toBe(true);
    expect(root.querySelector<HTMLInputElement>("[data-search]")?.value).toBe("squat");
    expect(root.querySelector('[data-level="beginner"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector('[data-area="lower"]')?.getAttribute("aria-pressed")).toBe("true");

    details?.querySelector<HTMLButtonElement>("[data-close-filters]")?.click();

    expect(details?.open).toBe(false);
    expect(onPanelToggle).toHaveBeenCalledWith("body", false);
    expect(root.querySelector<HTMLInputElement>("[data-search]")?.value).toBe("squat");
    expect(root.querySelector('[data-level="beginner"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector('[data-area="lower"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders the close control inside an opened body panel markup", () => {
    const html = filterPanelsHtml({ ...PANEL_STATE, openPanels: ["body"] }, SHOW_NONE);
    expect(html).toContain('data-panel="body" name="lib-filter" open');
    expect(html).toContain('aria-label="Close filters"');
  });
});
