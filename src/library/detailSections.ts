import type { SeedExercise } from "../data/seed";
import { escapeHtml } from "./present";

const MAX_IMAGES = 3;

export function summaryHtml(exercise: SeedExercise): string {
  return exercise.description ? `<p class="lib-summary">${escapeHtml(exercise.description)}</p>` : "";
}

/** Doodle first; otherwise licensed HTTPS images with their credit line. */
export function mediaHtml(exercise: SeedExercise): string {
  if (exercise.doodlePath) {
    return `<img class="doodle" src="${escapeHtml(exercise.doodlePath)}" alt="Doodle for ${escapeHtml(exercise.name)}" />`;
  }
  const images = (exercise.media ?? [])
    .filter((item) => item.mediaType === "image" && item.url.startsWith("https://") && item.license)
    .slice(0, MAX_IMAGES);
  if (images.length === 0) {
    return "";
  }
  const alt = escapeHtml(exercise.name);
  const figures = images.map((image) => figureHtml(image.url, alt, `${image.license} · ${image.source}`)).join("");
  return `<div class="lib-media">${figures}</div>`;
}

function figureHtml(url: string, alt: string, credit: string): string {
  return `<figure><img loading="lazy" src="${escapeHtml(url)}" alt="${alt}" /><figcaption>${escapeHtml(credit)}</figcaption></figure>`;
}

function listSection(title: string, items: readonly string[] | undefined, tag: "ol" | "ul", cls: string): string {
  if (!items?.length) {
    return "";
  }
  const body = items.map(listItem).join("");
  return `<p class="eyebrow">${escapeHtml(title)}</p><${tag} class="${cls}">${body}</${tag}>`;
}

function listItem(text: string): string {
  return `<li>${escapeHtml(text)}</li>`;
}

export function stepsHtml(exercise: SeedExercise): string {
  return listSection("How to", exercise.steps, "ol", "lib-steps");
}

export function cuesHtml(exercise: SeedExercise): string {
  return listSection("Cues", exercise.cues, "ul", "cues");
}

export function mistakesHtml(exercise: SeedExercise): string {
  return listSection("Common mistakes", exercise.mistakes, "ul", "lib-mistakes");
}

export function sourcesHtml(exercise: SeedExercise): string {
  const fallback = exercise.attribution ? [exercise.attribution] : [];
  const sources = exercise.sources?.length ? exercise.sources : fallback;
  if (sources.length === 0) {
    return "";
  }
  return `<p class="lib-sources">Text adapted from: ${sources.map(escapeHtml).join("; ")}</p>`;
}
