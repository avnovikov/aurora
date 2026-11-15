// Bundled fonts (latin, only the weights in use), so the APK works offline.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans-condensed/latin-500.css";
import "@fontsource/ibm-plex-sans-condensed/latin-600.css";
import "@fontsource/ibm-plex-sans-condensed/latin-700.css";
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
