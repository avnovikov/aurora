/** Slimmed wger `exerciseinfo` record (English only) as kept in data/raw. */
export interface WgerImage {
  url: string;
  license: string;
  author: string;
}

export interface WgerExerciseRecord {
  id: number;
  name: string;
  description: string;
  category: string;
  muscles: number[];
  musclesSecondary: number[];
  equipment: string[];
  license: string;
  licenseAuthor: string;
  images: WgerImage[];
}

export const WGER_SOURCE = "wger.de";
