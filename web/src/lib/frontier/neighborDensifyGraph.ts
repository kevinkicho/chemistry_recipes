/**
 * Impurity / related-entity densify priority graph.
 * Ranks neighbor PubChem CIDs for batch densify (impurities first).
 * Free-public evidence only — not a validated impurity control strategy.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { RelatedEntity } from "@/lib/types/process";
import type { ReactionNetwork } from "@/lib/frontier/reactionNetwork";
import { buildReactionNetwork } from "@/lib/frontier/reactionNetwork";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";

export const NEIGHBOR_DENSIFY_SCHEMA =
  "chemistry-recipes.neighbor-densify-graph.v1" as const;

export type NeighborPriorityRole =
  | "impurity"
  | "intermediate"
  | "starting-material"
  | "reagent"
  | "catalyst"
  | "solvent"
  | "product"
  | "other";

export interface NeighborDensifyTarget {
  cid: number;
  label: string;
  role: NeighborPriorityRole;
  /** Higher = densify sooner */
  priority: number;
  evidence: string[];
  cas?: string;
  href?: string;
}

export interface NeighborDensifyGraph {
  schema: typeof NEIGHBOR_DENSIFY_SCHEMA;
  centerCid: number;
  centerName: string;
  generatedAt: string;
  /** Ordered densify queue (impurities first) */
  queue: NeighborDensifyTarget[];
  campaignCids: number[];
  impurityCids: number[];
  intermediateCids: number[];
  summary: string;
  disclaimer: string;
}

const DISCLAIMER =
  "Neighbor densify graph from free-public related entities / network edges. " +
  "Not a GMP impurity control plan or validated reaction graph.";

const ROLE_PRIORITY: Record<NeighborPriorityRole, number> = {
  impurity: 100,
  intermediate: 80,
  "starting-material": 70,
  reagent: 50,
  catalyst: 45,
  solvent: 30,
  product: 40,
  other: 20,
};

function roleFromEntity(e: RelatedEntity): NeighborPriorityRole {
  const r = (e.role || "other").toLowerCase();
  if (r.includes("impur")) return "impurity";
  if (r.includes("intermed")) return "intermediate";
  if (r.includes("start")) return "starting-material";
  if (r.includes("reagent")) return "reagent";
  if (r.includes("catalyst")) return "catalyst";
  if (r.includes("solvent")) return "solvent";
  if (r.includes("product") || r === "api") return "product";
  return "other";
}

function roleFromNetwork(
  role: string
): NeighborPriorityRole {
  const r = role.toLowerCase();
  if (r.includes("impur")) return "impurity";
  if (r.includes("intermed")) return "intermediate";
  if (r.includes("start")) return "starting-material";
  if (r.includes("reagent")) return "reagent";
  if (r.includes("catalyst")) return "catalyst";
  if (r.includes("solvent")) return "solvent";
  if (r.includes("product")) return "product";
  return "other";
}

/**
 * Build prioritized densify targets for impurities and related CIDs.
 */
export function buildNeighborDensifyGraph(
  dossier: LiveDossier,
  network?: ReactionNetwork
): NeighborDensifyGraph {
  const atlas =
    dossier.processKnowledge?.conditionAtlas || buildConditionAtlas(dossier);
  const net =
    network ||
    dossier.processKnowledge?.reactionNetwork ||
    buildReactionNetwork(dossier, atlas);

  const byCid = new Map<number, NeighborDensifyTarget>();

  for (const e of dossier.relatedEntities || []) {
    const cid = e.pubchemCid;
    if (!cid || cid === dossier.cid || cid <= 0) continue;
    const role = roleFromEntity(e);
    const prev = byCid.get(cid);
    const priority = ROLE_PRIORITY[role];
    if (prev && prev.priority >= priority) {
      prev.evidence.push(e.notes || e.role || "related entity");
      continue;
    }
    byCid.set(cid, {
      cid,
      label: e.name,
      role,
      priority,
      evidence: [e.notes || `${e.role}: related entity`].filter(Boolean),
      cas: e.cas,
      href: e.href,
    });
  }

  for (const n of net.nodes) {
    const cid = n.pubchemCid;
    if (!cid || cid === dossier.cid || cid <= 0) continue;
    const role = roleFromNetwork(n.role);
    const priority = ROLE_PRIORITY[role];
    const prev = byCid.get(cid);
    if (prev) {
      if (priority > prev.priority) {
        prev.role = role;
        prev.priority = priority;
      }
      if (n.notes) prev.evidence.push(n.notes);
      continue;
    }
    byCid.set(cid, {
      cid,
      label: n.label,
      role,
      priority,
      evidence: n.notes ? [n.notes] : [`network:${n.role}`],
      cas: n.cas,
      href: n.href,
    });
  }

  // Boost from impurity edges
  for (const e of net.edges) {
    if (e.relation !== "impurity-of") continue;
    for (const n of net.nodes) {
      if (n.id !== e.from && n.id !== e.to) continue;
      const cid = n.pubchemCid;
      if (!cid || cid === dossier.cid) continue;
      const row = byCid.get(cid);
      if (row) {
        row.priority = Math.max(row.priority, ROLE_PRIORITY.impurity + 5);
        row.role = "impurity";
        row.evidence.push(...e.evidence.slice(0, 2));
      }
    }
  }

  const queue = [...byCid.values()].sort(
    (a, b) => b.priority - a.priority || a.cid - b.cid
  );

  const impurityCids = queue
    .filter((t) => t.role === "impurity")
    .map((t) => t.cid);
  const intermediateCids = queue
    .filter((t) => t.role === "intermediate")
    .map((t) => t.cid);
  const campaignCids = [
    dossier.cid,
    ...queue.map((t) => t.cid),
  ].filter((c, i, a) => a.indexOf(c) === i);

  const summary =
    queue.length === 0
      ? `No related PubChem CIDs for densify queue (CID ${dossier.cid})`
      : `Neighbor densify · ${queue.length} CID(s) · ${impurityCids.length} impurity · ${intermediateCids.length} intermediate · top: ${queue
          .slice(0, 3)
          .map((t) => `${t.label}(${t.role})`)
          .join(", ")}`;

  return {
    schema: NEIGHBOR_DENSIFY_SCHEMA,
    centerCid: dossier.cid,
    centerName: dossier.identity?.name || `CID ${dossier.cid}`,
    generatedAt: new Date().toISOString(),
    queue,
    campaignCids,
    impurityCids,
    intermediateCids,
    summary,
    disclaimer: DISCLAIMER,
  };
}

/** Impurity-first neighbor CIDs for science agent densify / campaigns */
export function prioritizedNeighborCids(
  dossier: LiveDossier,
  max = 4
): number[] {
  const g = buildNeighborDensifyGraph(dossier);
  // Impurities first, then rest of priority queue (already role-sorted)
  const imp = g.impurityCids.filter((c) => c !== dossier.cid);
  const rest = g.queue
    .map((t) => t.cid)
    .filter((c) => c !== dossier.cid && !imp.includes(c));
  return [...imp, ...rest].slice(0, max);
}

/** Default campaign CID set: center + impurity-first neighbors */
export function impurityFirstCampaignCids(
  dossier: LiveDossier,
  max = 8
): number[] {
  const g = buildNeighborDensifyGraph(dossier);
  const ordered = [
    dossier.cid,
    ...g.impurityCids,
    ...g.intermediateCids,
    ...g.queue.map((t) => t.cid),
  ];
  return ordered.filter((c, i, a) => a.indexOf(c) === i).slice(0, max);
}
