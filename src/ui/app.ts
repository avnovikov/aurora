import { planSession } from "../rules/planSession";
import { loadSession } from "../session/storage";
import { renderCheckIn } from "./checkIn";
import { renderSessionView } from "./sessionView";

export function bootApp(root: HTMLElement): void {
  const resume = loadSession();
  if (resume) {
    renderSessionView(root, {
      planned: resume.planned,
      resume,
      onDone: () => showCheckIn(root),
    });
    return;
  }
  showCheckIn(root);
}

function showCheckIn(root: HTMLElement): void {
  renderCheckIn(root, {
    onStart: (readiness) => {
      const planned = planSession(readiness);
      renderSessionView(root, {
        planned,
        onDone: () => showCheckIn(root),
      });
    },
  });
}
