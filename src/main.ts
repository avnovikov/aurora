import "./style.css";
import { bootApp } from "./ui/app";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("#app root missing");
}
bootApp(root);
