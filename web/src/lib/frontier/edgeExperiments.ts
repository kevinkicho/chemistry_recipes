/**
 * Auto-generate research experiments from network edge pairs.
 * Questions only — never plant setpoints.
 */

import type { ReactionNetwork } from "@/lib/frontier/reactionNetwork";
import type { LiveDossier } from "@/lib/dossier/types";
import type { NextExperiment } from "@/lib/frontier/types";
import {
  compareNetworkEdges,
  listComparableEdges,
  suggestEdgePairs,
} from "@/lib/frontier/edgeCompare";

/**
 * Build next-experiment suggestions from the strongest / most contrasting edges.
 */
export function buildEdgePairExperiments(
  network: ReactionNetwork,
  dossiers: LiveDossier[] = [],
  max = 8
): NextExperiment[] {
  const out: NextExperiment[] = [];
  const pairs = suggestEdgePairs(network, max);
  let i = 0;

  for (const p of pairs) {
    const cmp = compareNetworkEdges(network, p.a, p.b, dossiers);
    if (!cmp) continue;

    const thinA = cmp.edgeA.evidence.length === 0;
    const thinB = cmp.edgeB.evidence.length === 0;
    const priority: NextExperiment["priority"] =
      thinA || thinB ? "high" : cmp.edgeA.relation !== cmp.edgeB.relation ? "medium" : "low";

    out.push({
      id: `exp:edge:${i++}`,
      question: `Discriminate public evidence for “${cmp.edgeA.fromLabel}→${cmp.edgeA.toLabel}” (${cmp.edgeA.relation}) vs “${cmp.edgeB.fromLabel}→${cmp.edgeB.toLabel}” (${cmp.edgeB.relation})`,
      rationale: `${p.reason}. ${cmp.overlapNotes.slice(0, 2).join("; ")}`,
      gap:
        thinA || thinB
          ? "One or both edges lack free-text evidence strings — densify full-text windows"
          : `Edge pair contrast (${cmp.edgeA.relation} vs ${cmp.edgeB.relation})`,
      priority,
    });
  }

  // Single thin high-strength edges
  for (const e of listComparableEdges(network, 8)) {
    if (e.evidence.length > 0) continue;
    if (out.length >= max) break;
    const from =
      network.nodes.find((n) => n.id === e.from)?.label || e.from;
    const to = network.nodes.find((n) => n.id === e.to)?.label || e.to;
    out.push({
      id: `exp:edge-thin:${i++}`,
      question: `Mine free-public text supporting ${e.relation} between ${from} and ${to}`,
      rationale: `Network edge strength ${e.strength} but no evidence strings attached`,
      gap: "Thin edge evidence",
      priority: "high",
    });
  }

  return out.slice(0, max);
}

/**
 * Merge edge experiments into an existing next-experiment list (de-dupe by question prefix).
 */
export function mergeEdgeExperiments(
  base: NextExperiment[],
  network: ReactionNetwork,
  dossiers?: LiveDossier[]
): NextExperiment[] {
  const edge = buildEdgePairExperiments(network, dossiers || [], 6);
  const seen = new Set(base.map((e) => e.question.slice(0, 80)));
  const out = [...base];
  for (const e of edge) {
    const k = e.question.slice(0, 80);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out.slice(0, 16);
}
