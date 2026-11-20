import type { CaricatureId } from "./balance";

const RAW = import.meta.glob<string>("./caricatures/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * Balance caricatures (#234), inlined so the doodle CSS variables apply.
 * Keyed by file basename; src/style.css holds the shared reduced-motion rule
 * (`.bb-cari`) that swaps the animated `cv-*-m` group for the still `cv-*-s`.
 */
export const CARICATURES = Object.fromEntries(
  Object.entries(RAW).map(([path, svg]) => [path.slice(path.lastIndexOf("/") + 1, -".svg".length), svg.trim()]),
) as Readonly<Record<CaricatureId, string>>;
