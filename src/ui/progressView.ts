import { SEED_GRAPH, SESSION_TEMPLATES } from "../data/seed";
import {
  buildChainMap,
  KEY_CHAIN_ANCHOR_IDS,
  listChainRootIds,
  type ChainMap,
  type ChainNode,
  type LastResolveSignal,
} from "../progress/chainMap";
import { loadSession } from "../session/storage";
import { loadMemories } from "../session/history";

const NO_HR_HISTORY_NOTE = "Resting HR trend: no HR history yet";

export function renderProgressView(root: HTMLElement): void {
  const chains = buildProgressChains();
  root.innerHTML = `
    <main class="shell">
      <p class="eyebrow">Progress</p>
      <h1>Chains</h1>
      <p class="tagline">Harder skills are goals. The chalk line shows where you are, with easier and harder neighbours.</p>
      ${chains.map(chainHtml).join("")}
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

function chainHtml(chain: ChainMap): string {
  const nodes = chain.nodes.map(nodeHtml).join("");
  return `
    <section class="chain-card" data-chain="${chain.rootId}">
      <h2 class="chain-title">${chain.label}</h2>
      <ol class="chain-map">${nodes}</ol>
      <p class="chain-reason chain-${chain.status.kind}">${chain.status.reason}</p>
    </section>
  `;
}

function nodeHtml(node: ChainNode): string {
  const marker = node.position === "current" ? ' aria-current="step"' : "";
  return `<li class="chain-node chain-${node.position}"${marker}>${node.name}</li>`;
}
