import "./style.css";
import { PRODUCT_TAGLINE, aboutBlurb, productTitleLine } from "./brand/identity";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="shell">
    <p class="eyebrow">Morning session</p>
    <h1>${productTitleLine()}</h1>
    <p class="tagline">${PRODUCT_TAGLINE}</p>
    <p class="about">${aboutBlurb()}</p>
  </main>
`;
