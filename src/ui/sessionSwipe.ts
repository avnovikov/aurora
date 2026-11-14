export function wireSwipe(stage: HTMLElement, onFinish: () => void): void {
  let startX: number | null = null;
  stage.addEventListener("touchstart", (event) => {
    startX = event.changedTouches[0]?.clientX ?? null;
  });
  stage.addEventListener("touchend", (event) => {
    if (startX === null) {
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? startX;
    if (startX - endX > 80) {
      onFinish();
    }
    startX = null;
  });
  let mouseStart: number | null = null;
  stage.addEventListener("mousedown", (event) => {
    mouseStart = event.clientX;
  });
  stage.addEventListener("mouseup", (event) => {
    if (mouseStart === null) {
      return;
    }
    if (mouseStart - event.clientX > 80) {
      onFinish();
    }
    mouseStart = null;
  });
}