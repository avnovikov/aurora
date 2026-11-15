import "./style.css";
import { applyPalette } from "./brand/palettes";
import { loadProfile } from "./settings/profile";
import { bootApp } from "./ui/app";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("#app root missing");
}
// Before the first render, so the saved palette shows from the first frame.
applyPalette(loadProfile().palette);
bootApp(root);
