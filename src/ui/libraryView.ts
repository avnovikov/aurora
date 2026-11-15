import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import {
  SESSION_TEMPLATES,
  TEMPLATE_BY_ID,
  type LoadRegion,
  type SeedExercise,
} from "../data/seed";
import { mountLibraryDetail } from "../library/libraryDetail";
import { focusSearchInput, mountLibraryList } from "../library/libraryList";
import { mountPlanDayPicker } from "../library/libraryPlanPick";
import { searchExercises, type LevelFilter } from "../library/search";
import { collectTemplateTargetIds } from "../library/targets";
import { listUpcomingPlanDays } from "../plan/pathPlacement";
import {
  addExerciseToPlanDay,
  generatePlanTowardExercise,
} from "../plan/pathPlanActions";
import { loadPlanQueue, savePlanQueue } from "../plan/queue";
import { resolveTemplate } from "../plan/templates";
import { missingGear } from "../safety/gear";
import { prehabFor } from "../safety/prehab";
import {
  declareSkillTier,
  emptyMemory,
  loadMemories,
  saveMemories,
} from "../session/history";
import { loadProfile } from "../settings/profile";

const CATALOGUE_BY_ID: Record<string, SeedExercise> = Object.fromEntries(
  LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise]),
);

function templateDisplayName(templateId: string): string {
  return TEMPLATE_BY_ID[templateId]?.name ?? resolveTemplate(templateId).name;
}

export function renderLibraryView(root: HTMLElement): void {
  let text = "";
  let region: LoadRegion | "all" = "all";
  let level: LevelFilter = "all";
  let forJoints = false;
  let onlyGear = false;
  let selectedId: string | null = null;
  let pickingPlanForId: string | null = null;
  let planStatus: string | null = null;
  const { jointHistory, equipment } = loadProfile();
  const targetIds = collectTemplateTargetIds(SESSION_TEMPLATES);

  const paint = (): void => {
    if (pickingPlanForId) {
      paintPlanPicker(pickingPlanForId);
      return;
    }
    if (selectedId) {
      paintDetail(selectedId);
      return;
    }
    paintList();
  };

  const clearPlanStatusAndSelect = (exerciseId: string | null): void => {
    selectedId = exerciseId;
    planStatus = null;
    paint();
  };

  const paintPlanPicker = (exerciseId: string): void => {
    const exercise = CATALOGUE_BY_ID[exerciseId];
    if (!exercise) {
      pickingPlanForId = null;
      paint();
      return;
    }
    const days = listUpcomingPlanDays(loadPlanQueue(), templateDisplayName);
    mountPlanDayPicker(root, exercise.name, days, {
      onCancel: () => {
        pickingPlanForId = null;
        paint();
      },
      onConfirm: (templateId) => {
        const memory = loadMemories()[exerciseId] ?? emptyMemory(exerciseId);
        const result = addExerciseToPlanDay({
          templateId,
          exercise,
          memory,
        });
        planStatus = result.message;
        pickingPlanForId = null;
        selectedId = exerciseId;
        paint();
      },
    });
  };

  const paintDetail = (exerciseId: string): void => {
    const exercise = CATALOGUE_BY_ID[exerciseId];
    if (!exercise) {
      selectedId = null;
      paint();
      return;
    }
    const memory = loadMemories()[exerciseId] ?? emptyMemory(exerciseId);
    mountLibraryDetail(root, {
      exercise,
      targetIds,
      catalogueById: CATALOGUE_BY_ID,
      actions: {
        onBack: () => clearPlanStatusAndSelect(null),
        onOpenExercise: clearPlanStatusAndSelect,
        onDeclareTier: (id, tier) => {
          saveMemories(declareSkillTier(loadMemories(), id, tier));
          paint();
        },
        onGeneratePlan: () => {
          const result = generatePlanTowardExercise({
            exercise,
            queue: loadPlanQueue(),
            memory,
          });
          savePlanQueue(result.queue);
          planStatus = result.message;
          paint();
        },
        onAddToPlan: () => {
          pickingPlanForId = exerciseId;
          paint();
        },
      },
      jointHistory,
      memory: {
        skillTier: memory.skillTier,
        declaredTier: memory.declaredTier,
        bestReps: memory.bestReps,
      },
      planStatus,
    });
  };

  const paintList = (): void => {
    const pool = forJoints
      ? prehabFor(jointHistory, LIBRARY_CATALOGUE, equipment)
      : LIBRARY_CATALOGUE;
    const gearPool = onlyGear
      ? pool.filter((item) => missingGear(item.requires, equipment).length === 0)
      : pool;
    const results = searchExercises(gearPool, { text, region, level });
    mountLibraryList(
      root,
      results,
      targetIds,
      { text, region, level, forJoints, onlyGear },
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
        onSelect: (id) => {
          selectedId = id;
          planStatus = null;
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
