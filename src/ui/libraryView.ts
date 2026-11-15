import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import type { LoadRegion } from "../data/seed";
import { LIBRARY_REGIONS, searchExercises } from "../library/search";

export function renderLibraryView(root: HTMLElement): void {
  let text = "";
  let region: LoadRegion | "all" = "all";

  const paint = (): void => {
    const results = searchExercises(LIBRARY_CATALOGUE, { text, region });
    root.innerHTML = `
      <main class="shell">
        <p class="eyebrow">Library</p>
        <h1>Exercises</h1>
        <p class="tagline">Core is an area filter — abs, hollow, anti-extension, and friends.</p>
        <input class="search" type="search" placeholder="Search exercises" value="${escapeAttr(text)}" data-search />
        <div class="row wrap" data-regions>
          ${LIBRARY_REGIONS.map(
            (item) =>
              `<button type="button" data-region="${item}" class="${item === region ? "selected" : ""}">${labelRegion(item)}</button>`,
          ).join("")}
        </div>
        <ul class="lib-list">
          ${results
            .map(
              (exercise) => `
            <li class="${exercise.regions.includes("core") ? "core-hit" : ""}">
              <strong>${exercise.name}</strong>
              <span>${exercise.pattern} · ${exercise.regions.join(", ")}</span>
              <p class="hint">${exercise.cues[0] ?? ""}</p>
            </li>`,
            )
            .join("")}
        </ul>
      </main>
    `;

    root.querySelector<HTMLInputElement>("[data-search]")?.addEventListener("input", (event) => {
      text = (event.target as HTMLInputElement).value;
      paint();
      const input = root.querySelector<HTMLInputElement>("[data-search]");
      if (input) {
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      }
    });

    root.querySelectorAll<HTMLButtonElement>("[data-region]").forEach((button) => {
      button.addEventListener("click", () => {
        region = button.dataset.region as LoadRegion | "all";
        paint();
      });
    });
  };

  paint();
}

function labelRegion(region: LoadRegion | "all"): string {
  if (region === "all") {
    return "All";
  }
  if (region === "core") {
    return "Core";
  }
  return region.charAt(0).toUpperCase() + region.slice(1);
}

function escapeAttr(value: string): string {
  return value.replaceAll('"', "&quot;");
}
