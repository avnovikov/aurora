import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import {
  SESSION_TEMPLATES,
  type LoadRegion,
  type SeedExercise,
} from "../data/seed";
import { mountLibraryDetail } from "../library/libraryDetail";
import { focusSearchInput, mountLibraryList } from "../library/libraryList";
import type { AreaFilter, MuscleFilter, StretchFilter } from "../library/facets";
import { selectLibraryResults } from "../library/results";
import type { LevelFilter } from "../library/search";
import { loadProfile } from "../settings/profile";
import { collectTemplateTargetIds } from "../library/targets";
import {
  declareSkillTier,
  emptyMemory,
  loadMemories,
  saveMemories,
} from "../session/history";

const CATALOGUE_BY_ID: Record<string, SeedExercise> = Object.fromEntries(
  LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise]),
);

export function renderLibraryView(root: HTMLElement): void {
  let text = "";
  let region: LoadRegion | "all" = "all";
  let level: LevelFilter = "all";
  let area: AreaFilter = "all";
  let muscle: MuscleFilter = "all";
  let stretch: StretchFilter = "hide";
  let forJoints = false;
  let onlyGear = false;
  let selectedId: string | null = null;
  const { jointHistory, equipment } = loadProfile();
  const targetIds = collectTemplateTargetIds(SESSION_TEMPLATES);

  const paint = (): void => {
    if (selectedId) {
      const exercise = CATALOGUE_BY_ID[selectedId];
      if (!exercise) {
        selectedId = null;
        paint();
        return;
      }
      const memory = loadMemories()[selectedId] ?? emptyMemory(selectedId);
      mountLibraryDetail(root, {
        exercise,
        targetIds,
        catalogueById: CATALOGUE_BY_ID,
        actions: {
          onBack: () => {
            selectedId = null;
            paint();
          },
          onOpenExercise: (id) => {
            selectedId = id;
            paint();
          },
          onDeclareTier: (exerciseId, tier) => {
            saveMemories(declareSkillTier(loadMemories(), exerciseId, tier));
            paint();
          },
        },
        jointHistory,
        memory: {
          skillTier: memory.skillTier,
          declaredTier: memory.declaredTier,
          bestReps: memory.bestReps,
        },
      });
      return;
    }

    const { results, hiddenStretches } = selectLibraryResults({
      catalogue: LIBRARY_CATALOGUE,
      query: { text, region, level, area, muscle, stretch },
      forJoints,
      onlyGear,
      jointHistory,
      equipment,
    });
    mountLibraryList(
      root,
      results,
      targetIds,
      { text, region, level, area, muscle, stretch, hiddenStretches, forJoints, onlyGear },
      {
        onSearch: (next) => {
          text = next;
          paint();
          focusSearchInput(root);
        },
        onRegion: (next) => {
          region = next;
          paint();
        },
        onLevel: (next) => {
          level = next;
          paint();
        },
        onArea: (next) => {
          area = next;
          paint();
        },
        onMuscle: (next) => {
          muscle = next;
          paint();
        },
        onStretch: (next) => {
          stretch = next;
          paint();
        },
        onSelect: (id) => {
          selectedId = id;
          paint();
        },
        onForJoints: (on) => {
          forJoints = on;
          paint();
        },
        onOnlyGear: (on) => {
          onlyGear = on;
          paint();
        },
      },
      jointHistory,
    );
  };

  paint();
}
