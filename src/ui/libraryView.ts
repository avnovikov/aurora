import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import type { SeedExercise } from "../data/seed";
import { mountLibraryDetail } from "../library/libraryDetail";
import { DEFAULT_FILTERS, withPanelState, type FilterPanelId } from "../library/filterPanels";
import { focusSearchInput, mountLibraryList, type ListQueryState } from "../library/libraryList";
import { mountPlanDayPicker } from "../library/libraryPlanPick";
import { selectLibraryResults } from "../library/results";
import { collectTemplateTargetIds } from "../library/targets";
import { listUpcomingPlanDays } from "../plan/pathPlacement";
import {
  addExerciseToPlanDay,
  generatePlanTowardExercise,
} from "../plan/pathPlanActions";
import { loadPlanQueue, savePlanQueue } from "../plan/queue";
import { dayTitle } from "../plan/dayKinds";
import { listAllTemplates, resolveTemplate } from "../plan/templates";
import {
  declareSkillTier,
  emptyMemory,
  loadMemories,
  saveMemories,
} from "../session/history";
import { loadProfile } from "../settings/profile";

/** Every list filter with a value; "hiddenStretches" is computed, not chosen. */
type ListFilters = Required<Omit<ListQueryState, "hiddenStretches" | "openPanels">>;

const CATALOGUE_BY_ID: Record<string, SeedExercise> = Object.fromEntries(
  LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise]),
);

function templateDisplayName(templateId: string): string {
  return dayTitle(resolveTemplate(templateId));
}

export function renderLibraryView(root: HTMLElement): void {
  const filters: ListFilters = { text: "", ...DEFAULT_FILTERS };
  const setFilter = <K extends keyof ListFilters>(key: K, value: ListFilters[K]): void => {
    filters[key] = value;
    paint();
  };
  let openPanels: FilterPanelId[] = [];
  let selectedId: string | null = null;
  let pickingPlanForId: string | null = null;
  let planStatus: string | null = null;
  let cascadeHint: string | null = null;
  const { jointHistory, equipment } = loadProfile();
  const targetIds = collectTemplateTargetIds(listAllTemplates());

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
    cascadeHint = null;
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
          const result = declareSkillTier(loadMemories(), id, tier);
          saveMemories(result.memories);
          cascadeHint = cascadeHintFor(result.cascadedCount);
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
      cascadeHint,
    });
  };

  const paintList = (): void => {
    const { forJoints, onlyGear, ...query } = filters;
    const { results, hiddenStretches } = selectLibraryResults({
      catalogue: LIBRARY_CATALOGUE,
      query,
      forJoints,
      onlyGear,
      jointHistory,
      equipment,
    });
    mountLibraryList(
      root,
      results,
      targetIds,
      { ...filters, hiddenStretches, openPanels },
      {
        onSearch: (next) => {
          setFilter("text", next);
          focusSearchInput(root);
        },
        onLevel: (next) => setFilter("level", next),
        onArea: (next) => setFilter("area", next),
        onMuscle: (next) => setFilter("muscle", next),
        onStretch: (next) => setFilter("stretch", next),
        onForJoints: (on) => setFilter("forJoints", on),
        onOnlyGear: (on) => setFilter("onlyGear", on),
        onClearFilters: () => {
          Object.assign(filters, DEFAULT_FILTERS);
          paint();
        },
        onPanelToggle: (panel, open) => {
          openPanels = withPanelState(openPanels, panel, open);
        },
        onSelect: (id) => {
          selectedId = id;
          planStatus = null;
          cascadeHint = null;
          paint();
        },
      },
      jointHistory,
    );
  };

  paint();
}

function cascadeHintFor(cascadedCount: number): string | null {
  if (cascadedCount === 0) {
    return null;
  }
  const moves = cascadedCount === 1 ? "move" : "moves";
  return `Updated ${cascadedCount} related ${moves} in this family.`;
}
