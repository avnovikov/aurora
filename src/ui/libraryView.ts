import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import {
  SESSION_TEMPLATES,
  type LoadRegion,
  type SeedExercise,
} from "../data/seed";
import { mountLibraryDetail } from "../library/libraryDetail";
import { focusSearchInput, mountLibraryList } from "../library/libraryList";
import { searchExercises } from "../library/search";
import { missingGear } from "../safety/gear";
import { prehabFor } from "../safety/prehab";
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

    const pool = forJoints ? prehabFor(jointHistory, LIBRARY_CATALOGUE, equipment) : LIBRARY_CATALOGUE;
    const gearPool = onlyGear
      ? pool.filter((item) => missingGear(item.requires, equipment).length === 0)
      : pool;
    const results = searchExercises(gearPool, { text, region });
    mountLibraryList(
      root,
      results,
      targetIds,
      { text, region, forJoints, onlyGear },
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
