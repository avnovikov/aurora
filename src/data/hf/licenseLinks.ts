import type { HfLink } from "./types";

const ALLOWED_MEDIA_LICENSES = new Set([
  "CC-BY-SA",
  "CC-BY-SA-3.0",
  "public-domain",
]);

export function isAllowedHfMediaLink(link: HfLink): boolean {
  const license = link.license?.trim();
  if (!license) {
    return false;
  }
  if (!ALLOWED_MEDIA_LICENSES.has(license)) {
    return false;
  }
  if (link.source === "free-exercise-db") {
    return false;
  }
  if (isMuscleWikiBarePage(link)) {
    return false;
  }
  if (link.type === "page") {
    return false;
  }
  return true;
}

function isMuscleWikiBarePage(link: HfLink): boolean {
  if (link.source !== "musclewiki.com") {
    return false;
  }
  return link.type === "page";
}

export function filterAllowedHfMediaLinks(links: HfLink[]): HfLink[] {
  return links.filter(isAllowedHfMediaLink);
}