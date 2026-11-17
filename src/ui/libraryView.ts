import { LIBRARY_CATALOGUE } from "../data/libraryCatalogue";
import type { SeedExercise } from "../data/seed";
import { displayExerciseName } from "../library/displayName";
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { mountLibraryDetail } from "../library/libraryDetail";
import { describeLevelSource } from "../library/levelSource";
import { suggestionFor } from "../progress/suggestTiers";
import {
  readScrollY,
  restoreScrollY,
  shouldScrollDetailToTop,
} from "../library/detailScroll";
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
import { excludeExercise, isExcluded, loadExcluded, restoreExercise } from "../plan/exclusions";
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
  /** Exercise currently shown on detail; null while the list is up. */
  let detailExerciseId: string | null = null;
  /** Window scroll of the list, restored when leaving detail. */
  let listScrollY = 0;
  let pickingPlanForId: string | null = null;
  let planStatus: string | null = null;
  let inferenceHint: string | null = null;
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
    inferenceHint = null;
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
    mountPlanDayPicker(root, displayExerciseName(exercise.name), days, {
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
    const scrollToTop = shouldScrollDetailToTop(detailExerciseId, exerciseId);
    if (detailExerciseId === null) {
      listScrollY = readScrollY();
    }
    detailExerciseId = exerciseId;
    const now = new Date();
    const memories = loadMemories(now);
    const memory = memories[exerciseId] ?? emptyMemory(exerciseId);
    mountLibraryDetail(root, {
      exercise,
      targetIds,
      catalogueById: CATALOGUE_BY_ID,
      scrollToTop,
      actions: {
        onBack: () => clearPlanStatusAndSelect(null),
        onOpenExercise: clearPlanStatusAndSelect,
        onDeclareTier: (id, tier) => {
          const result = declareSkillTier(loadMemories(), id, tier);
          saveMemories(result.memories);
          inferenceHint = inferenceHintFor(result.inferredCount);
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
        onToggleExcluded: (exclude) => {
          if (exclude) {
            excludeExercise(exerciseId);
          } else {
            restoreExercise(exerciseId);
          }
          paint();
        },
      },
      excluded: isExcluded(exerciseId),
      jointHistory,
      memory: {
        skillTier: memory.skillTier,
        declaredTier: memory.declaredTier,
        bestReps: memory.bestReps,
        source: describeLevelSource(memory, now, (id) => EXERCISE_GRAPH[id]?.name ?? id),
        suggestion: suggestionFor(exerciseId, memories, (id) => EXERCISE_GRAPH[id]?.pattern),
      },
      planStatus,
      cascadeHint: inferenceHint,
    });
  };

  const paintList = (): void => {
    detailExerciseId = null;
    const { forJoints, onlyGear, excludedOnly, ...query } = filters;
    const excluded = loadExcluded();
    const { results, hiddenStretches } = selectLibraryResults({
      catalogue: LIBRARY_CATALOGUE,
      query,
      forJoints,
      onlyGear,
      jointHistory,
      equipment,
      excludedOnly: excludedOnly ? excluded : undefined,
    });
    mountLibraryList(root, {
      results,
      targetIds,
      query: { ...filters, hiddenStretches, openPanels },
      jointHistory,
      excluded: new Set(excluded),
      actions: {
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
        onExcludedOnly: (on) => setFilter("excludedOnly", on),
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
          inferenceHint = null;
          paint();
        },
      },
    });
    restoreScrollY(listScrollY);
  };

  paint();
}

function inferenceHintFor(inferredCount: number): string | null {
  if (inferredCount === 0) {
    return null;
  }
  const moves = inferredCount === 1 ? "move" : "moves";
  return `${inferredCount} related ${moves} now inferred from your levels.`;
}
