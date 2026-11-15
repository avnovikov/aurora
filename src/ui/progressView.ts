import { SEED_GRAPH, SESSION_TEMPLATES } from "../data/seed";
import {
  buildChainMap,
  KEY_CHAIN_ANCHOR_IDS,
  listChainRootIds,
  type ChainMap,
  type LastResolveSignal,
} from "../progress/chainMap";
import {
  compactProgressBlock,
  type CompactProgressBlock,
} from "../progress/compactProgress";
import { loadSession } from "../session/storage";
import { loadMemories } from "../session/history";
import { escapeHtml } from "../library/present";

const NO_HR_HISTORY_NOTE = "Resting HR trend: no HR history yet";

export function renderProgressView(root: HTMLElement): void {
  const chains = buildProgressChains();
  root.innerHTML = `
    <main class="shell">
      <p class="eyebrow">Progress</p>
      <h1>Chains</h1>
      <p class="tagline">Where you are now, and the next step up.</p>
      ${chains.map(chainCardHtml).join("")}
      <p class="hint">${NO_HR_HISTORY_NOTE}</p>
    </main>
  `;
}

function buildProgressChains(): ChainMap[] {
  const memories = loadMemories();
  const planExerciseIds = SESSION_TEMPLATES.flatMap((template) =>
    template.slots.map((slot) => slot.exerciseId),
  );
  const lastResolveFor = lastResolveLookup();
  return listChainRootIds(SESSION_TEMPLATES, KEY_CHAIN_ANCHOR_IDS, SEED_GRAPH).map(
    (rootId) =>
      buildChainMap(rootId, planExerciseIds, memories, SEED_GRAPH, lastResolveFor),
  );
}

/** Reads rule ids for exercises in the last saved session plan. */
function lastResolveLookup(): (
  exerciseId: string,
) => LastResolveSignal | undefined {
  const workItems = loadSession()?.planned.work ?? [];
  return (exerciseId) => {
    const item = workItems.find((work) => work.exerciseId === exerciseId);
    return item ? { ruleIds: item.ruleIds } : undefined;
  };
}

function chainCardHtml(chain: ChainMap): string {
  const block = compactProgressBlock(chain);
  return `
    <section class="chain-card" data-chain="${escapeHtml(chain.rootId)}">
      <h2 class="chain-title">${escapeHtml(chain.label)}</h2>
      ${exerciseBlockHtml(block)}
      <p class="chain-reason chain-${chain.status.kind}">${escapeHtml(chain.status.reason)}</p>
    </section>
  `;
}

function exerciseBlockHtml(block: CompactProgressBlock): string {
  const next = block.next
    ? `<p class="exercise-next"><span class="exercise-next-label">Next</span> ${escapeHtml(block.next.name)}</p>`
    : `<p class="exercise-next is-end">Top of this chain</p>`;
  return `
    <div class="exercise-block">
      <p class="exercise-current" aria-current="step">${escapeHtml(block.current.name)}</p>
      ${next}
    </div>
  `;
}
