import {
  SEED_GRAPH,
  SEED_EXERCISES,
  SESSION_TEMPLATES,
  type LoadRegion,
} from "../data/seed";
import { mountLibraryDetail } from "../library/libraryDetail";
import { focusSearchInput, mountLibraryList } from "../library/libraryList";
import { searchExercises } from "../library/search";
import { collectTemplateTargetIds } from "../library/targets";

export function renderLibraryView(root: HTMLElement): void {
  let text = "";
  let region: LoadRegion | "all" = "all";
  let selectedId: string | null = null;
  const targetIds = collectTemplateTargetIds(SESSION_TEMPLATES);

  const paint = (): void => {
    if (selectedId) {
      const exercise = SEED_GRAPH[selectedId];
      if (!exercise) {
        selectedId = null;
        paint();
        return;
      }
      mountLibraryDetail(root, exercise, targetIds, {
        onBack: () => {
          selectedId = null;
          paint();
        },
        onOpenExercise: (id) => {
          selectedId = id;
          paint();
        },
      });
      return;
    }

    const results = searchExercises(SEED_EXERCISES, { text, region });
    mountLibraryList(
      root,
      results,
      targetIds,
      { text, region },
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
      },
    );
  };

  paint();
}