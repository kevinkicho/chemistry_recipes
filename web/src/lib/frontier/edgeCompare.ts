/**
 * Compare evidence on two network edges (or two relation types) across a campaign graph.
 * Free-public quotes only — not route selection advice.
 */

import type { NetworkEdge, NetworkNode, ReactionNetwork } from "@/lib/frontier/reactionNetwork";
import type { ConditionDistribution } from "@/lib/frontier/types";
import type { LiveDossier } from "@/lib/dossier/types";

export interface EdgeEvidenceRow {
  edgeId: string;
  relation: string;
  fromLabel: string;
  toLabel: string;
  strength: number;
  evidence: string[];
  /** Related condition quotes from linked CID packages when available */
  conditionSnippets: Array<{ kind: string; raw: string; quote: string; source?: string }>;
  pubchemCids: number[];
}

export interface EdgeCompareResult {
  edgeA: EdgeEvidenceRow;
  edgeB: EdgeEvidenceRow;
  overlapNotes: string[];
  summary: string;
  disclaimer: string;
}

const DISCLAIMER =
  "Edge comparison from free-public related-entity / process language only. " +
  "Not a validated reaction scheme or plant preference.";

function nodeLabel(nodes: NetworkNode[], id: string): string {
  return nodes.find((n) => n.id === id)?.label || id;
}

function nodeCid(nodes: NetworkNode[], id: string): number | undefined {
  return nodes.find((n) => n.id === id)?.pubchemCid;
}

function snippetsForCids(
  cids: number[],
  dossiers: LiveDossier[],
  max = 4
): EdgeEvidenceRow["conditionSnippets"] {
  const out: EdgeEvidenceRow["conditionSnippets"] = [];
  for (const cid of cids) {
    const d = dossiers.find((x) => x.cid === cid);
    const dists = d?.processKnowledge?.conditionAtlas?.distributions || [];
    for (const dist of dists.slice(0, 4)) {
      for (const o of dist.observations.slice(0, 2)) {
        out.push({
          kind: dist.kind,
          raw: o.raw,
          quote: o.quote.slice(0, 140),
          source: o.sourceLabel,
        });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

export function edgeToRow(
  edge: NetworkEdge,
  network: ReactionNetwork,
  dossiers: LiveDossier[] = []
): EdgeEvidenceRow {
  const fromCid = nodeCid(network.nodes, edge.from);
  const toCid = nodeCid(network.nodes, edge.to);
  const cids = [fromCid, toCid].filter((c): c is number => !!c && c > 0);
  return {
    edgeId: edge.id,
    relation: edge.relation,
    fromLabel: nodeLabel(network.nodes, edge.from),
    toLabel: nodeLabel(network.nodes, edge.to),
    strength: edge.strength,
    evidence: edge.evidence,
    conditionSnippets: snippetsForCids(cids, dossiers),
    pubchemCids: cids,
  };
}

/**
 * Pick two edges by id and compare evidence side-by-side.
 */
export function compareNetworkEdges(
  network: ReactionNetwork,
  edgeIdA: string,
  edgeIdB: string,
  dossiers: LiveDossier[] = []
): EdgeCompareResult | null {
  const a = network.edges.find((e) => e.id === edgeIdA);
  const b = network.edges.find((e) => e.id === edgeIdB);
  if (!a || !b) return null;

  const edgeA = edgeToRow(a, network, dossiers);
  const edgeB = edgeToRow(b, network, dossiers);

  const overlapNotes: string[] = [];
  if (edgeA.relation === edgeB.relation) {
    overlapNotes.push(`Same relation type: ${edgeA.relation}`);
  } else {
    overlapNotes.push(
      `Different relations: ${edgeA.relation} vs ${edgeB.relation}`
    );
  }
  const sharedCids = edgeA.pubchemCids.filter((c) =>
    edgeB.pubchemCids.includes(c)
  );
  if (sharedCids.length) {
    overlapNotes.push(`Shared PubChem CID(s): ${sharedCids.join(", ")}`);
  }
  if (edgeA.fromLabel === edgeB.fromLabel || edgeA.toLabel === edgeB.toLabel) {
    overlapNotes.push("Edges share an endpoint label");
  }
  if (!edgeA.evidence.length && !edgeB.evidence.length) {
    overlapNotes.push("Both edges have thin free-text evidence — densify further");
  }

  const summary = `Compare “${edgeA.fromLabel}→${edgeA.toLabel}” (${edgeA.relation}, str ${edgeA.strength}) vs “${edgeB.fromLabel}→${edgeB.toLabel}” (${edgeB.relation}, str ${edgeB.strength})`;

  return {
    edgeA,
    edgeB,
    overlapNotes,
    summary,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Rank edges by strength for UI pickers.
 */
export function listComparableEdges(
  network: ReactionNetwork,
  limit = 24
): NetworkEdge[] {
  return [...network.edges]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

/**
 * Suggest interesting edge pairs (different relations or high strength).
 */
export function suggestEdgePairs(
  network: ReactionNetwork,
  maxPairs = 6
): Array<{ a: string; b: string; reason: string }> {
  const edges = listComparableEdges(network, 16);
  const pairs: Array<{ a: string; b: string; reason: string }> = [];
  for (let i = 0; i < edges.length && pairs.length < maxPairs; i++) {
    for (let j = i + 1; j < edges.length && pairs.length < maxPairs; j++) {
      const a = edges[i]!;
      const b = edges[j]!;
      if (a.relation !== b.relation) {
        pairs.push({
          a: a.id,
          b: b.id,
          reason: `${a.relation} vs ${b.relation}`,
        });
      } else if (a.strength >= 50 && b.strength >= 50) {
        pairs.push({
          a: a.id,
          b: b.id,
          reason: "two strong same-relation edges",
        });
      }
    }
  }
  return pairs;
}

/** Compare atlas condition kinds across two CIDs (side evidence for edges) */
export function compareConditionKinds(
  a: ConditionDistribution[],
  b: ConditionDistribution[]
): Array<{ kind: string; aN: number; bN: number; note: string }> {
  const kinds = new Set([...a.map((x) => x.kind), ...b.map((x) => x.kind)]);
  return [...kinds].map((kind) => {
    const da = a.find((x) => x.kind === kind);
    const db = b.find((x) => x.kind === kind);
    const aN = da?.n ?? 0;
    const bN = db?.n ?? 0;
    let note = "—";
    if (aN && bN && da?.conflict) note = "A has range conflict";
    if (aN && bN && db?.conflict) note = note === "—" ? "B has range conflict" : note + "; B conflict";
    if (aN === 0 || bN === 0) note = "Missing on one side";
    return { kind, aN, bN, note };
  });
}
