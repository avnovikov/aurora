export interface HfLink {
  source: string;
  type: string;
  url: string;
  license: string | null;
}

export interface HfExerciseRecord {
  id: number;
  name: string;
  category: string;
  primary_muscles: string[];
  description: string;
  progression_1: string;
  progression_2: string;
  progression_3: string;
  links: HfLink[];
}

export const HF_DATASET_ATTRIBUTION =
  "Martjn/calisthenics_exercises (Apache-2.0), Hugging Face";