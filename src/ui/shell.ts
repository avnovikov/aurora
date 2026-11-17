export type AppTab =
  | "today"
  | "library"
  | "progress"
  | "history"
  | "body"
  | "plan"
  | "settings";

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: "today", label: "Today" },
  { id: "library", label: "Library" },
  { id: "progress", label: "Progress" },
  { id: "history", label: "History" },
  { id: "body", label: "Body" },
  { id: "plan", label: "Plan" },
  { id: "settings", label: "Settings" },
];

export function renderShell(
  root: HTMLElement,
  active: AppTab,
  mainHtml: string,
  onTab: (tab: AppTab) => void,
): void {
  root.innerHTML = `
    <div class="app-shell">
      <div class="app-main">${mainHtml}</div>
      <nav class="tab-bar" aria-label="Main">
        ${TABS.map(
          (tab) =>
            `<button type="button" class="${tab.id === active ? "active" : ""}" data-tab="${tab.id}"${tab.id === active ? ' aria-current="page"' : ""}>${tab.label}</button>`,
        ).join("")}
      </nav>
    </div>
  `;
  root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      onTab(button.dataset.tab as AppTab);
    });
  });
}
