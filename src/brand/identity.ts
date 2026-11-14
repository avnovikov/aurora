/** Product identity: GitHub/public name Aurora; soul mark Rassvet in-app. */
export const PRODUCT_NAME = "Aurora";
export const SOUL_NAME = "Rassvet";
export const SOUL_NAME_CYRILLIC = "Рассвет";
export const PRODUCT_TAGLINE = "Morning training — measured, not motivated.";

export function productTitleLine(): string {
  return `${PRODUCT_NAME} · ${SOUL_NAME}`;
}

export function aboutBlurb(): string {
  return `${PRODUCT_NAME} (${SOUL_NAME}, ${SOUL_NAME_CYRILLIC}) is a private morning coach: sleep, pulse, load, and stalls drive the dose.`;
}
