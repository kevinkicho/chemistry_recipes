/**
 * Multi-CID reaction / process network from related entities + densified cues.
 * Edges are evidence-linked when possible — not invented reaction schemes.
 * Harvest failure is not "Network is center-only".
 * Leftover identity / annotation HTTP is not a reaction-network miss.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { RelatedEntity } from "@/lib/types/process";
import type { ConditionAtlas } from "@/lib/frontier/types";
import { formatProcessFactsEmptyCopy } from "@/lib/dossier/sectionHonesty";

export type NetworkNodeRole =
  | "center"
  | "starting-material"
  | "intermediate"
  | "reagent"
  | "catalyst"
  | "solvent"
  | "impurity"
  | "product"
  | "other";

export interface NetworkNode {
  id: string;
  label: string;
  role: NetworkNodeRole;
  pubchemCid?: number;
  cas?: string;
  href?: string;
  notes?: string;
}

export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  /** Evidence-backed relation label */
  relation:
    | "process-related"
    | "starting-material-of"
    | "intermediate-of"
    | "impurity-of"
    | "reagent-for"
    | "solvent-for"
    | "catalyst-for";
  evidence: string[];
  strength: number;
}

export interface ReactionNetwork {
  cid: number;
  centerName: string;
  generatedAt: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** CIDs that can be batch-densified as a campaign */
  campaignCids: number[];
  summary: string;
  disclaimer: string;
}

const DISCLAIMER =
  "Multi-CID network from free-public related entities and process language. " +
  "Edges are not validated reaction schemes or IP claims.";

function roleOf(e: RelatedEntity): NetworkNodeRole {
  const r = (e.role || "other").toLowerCase();
  if (r.includes("start")) return "starting-material";
  if (r.includes("intermed")) return "intermediate";
  if (r.includes("impur")) return "impurity";
  if (r.includes("reagent")) return "reagent";
  if (r.includes("catalyst")) return "catalyst";
  if (r.includes("solvent")) return "solvent";
  if (r.includes("product") || r === "api") return "product";
  return "other";
}

function relationFor(role: NetworkNodeRole): NetworkEdge["relation"] {
  switch (role) {
    case "starting-material":
      return "starting-material-of";
    case "intermediate":
      return "intermediate-of";
    case "impurity":
      return "impurity-of";
    case "reagent":
      return "reagent-for";
    case "solvent":
      return "solvent-for";
    case "catalyst":
      return "catalyst-for";
    default:
      return "process-related";
  }
}


const CLEAN_EMPTY_NETWORK =
  "Network is center-only — densify related entities / route materials to expand the multi-CID graph.";

/**
 * Reaction-network empty copy comes from literature / patent / manufacturing harvest.
 * Harvest failure is not a clean "center-only" miss.
 * Leftover identity / annotation HTTP is not a reaction-network miss.
 */
function honestReactionNetworkSummary(dossier: LiveDossier, cleanEmpty: string): string {
  const harvest = formatProcessFactsEmptyCopy({
    traces: dossier.traces,
    fetchErrors: dossier.fetchErrors,
  });
  return harvest.kind === "error" ? harvest.message : cleanEmpty;
}

/**
 * Build a process-centric multi-CID network for one dossier.
 */
export function buildReactionNetwork(
  dossier: LiveDossier,
  atlas?: ConditionAtlas
): ReactionNetwork {
  const centerId = `cid:${dossier.cid}`;
  const centerName = dossier.identity?.name || `CID ${dossier.cid}`;
  const nodes: NetworkNode[] = [
    {
      id: centerId,
      label: centerName,
      role: "center",
      pubchemCid: dossier.cid,
      cas: dossier.identity?.cas,
    },
  ];
  const edges: NetworkEdge[] = [];
  const seen = new Set<string>([centerId]);
  let ei = 0;

  const entities = dossier.relatedEntities || [];
  for (const e of entities.slice(0, 40)) {
    const role = roleOf(e);
    const id = e.pubchemCid
      ? `cid:${e.pubchemCid}`
      : e.cas
        ? `cas:${e.cas}`
        : `name:${e.name.toLowerCase().slice(0, 40)}`;
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push({
        id,
        label: e.name,
        role,
        pubchemCid: e.pubchemCid,
        cas: e.cas,
        href: e.href,
        notes: e.notes,
      });
    }
    const evidence: string[] = [];
    if (e.notes) evidence.push(e.notes.slice(0, 160));
    if (e.cas) evidence.push(`CAS ${e.cas}`);
    // Boost strength when atlas solvents/catalysts match
    let strength = 40;
    if (atlas) {
      const nameL = e.name.toLowerCase();
      if (atlas.solvents.some((s) => nameL.includes(s.name.toLowerCase()))) {
        strength += 20;
        evidence.push("Matches solvent cue in condition atlas");
      }
      if (atlas.catalysts.some((s) => nameL.includes(s.name.toLowerCase()))) {
        strength += 20;
        evidence.push("Matches catalyst/reagent cue in condition atlas");
      }
    }
    if (e.pubchemCid) strength += 15;

    edges.push({
      id: `e:${ei++}`,
      from: role === "impurity" || role === "product" ? centerId : id,
      to:
        role === "impurity" || role === "product"
          ? id
          : centerId,
      relation: relationFor(role),
      evidence: evidence.slice(0, 4),
      strength: Math.min(100, strength),
    });
  }

  // Material names from preferred route as soft nodes
  const route = dossier.processRoutes?.[0];
  for (const m of (route?.materials || []).slice(0, 12)) {
    const id = `mat:${m.name.toLowerCase().slice(0, 40)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const role: NetworkNodeRole =
      m.role === "starting-material"
        ? "starting-material"
        : m.role === "solvent"
          ? "solvent"
          : m.role === "catalyst"
            ? "catalyst"
            : m.role === "product"
              ? "product"
              : "reagent";
    nodes.push({
      id,
      label: m.name,
      role,
      cas: m.cas,
      notes: m.notes || m.stoich,
    });
    edges.push({
      id: `e:${ei++}`,
      from: role === "product" ? centerId : id,
      to: role === "product" ? id : centerId,
      relation: relationFor(role),
      evidence: [
        `From process route materials (${route?.name || "route"})`,
        m.stoich ? `stoich ${m.stoich}` : "",
      ].filter(Boolean),
      strength: 35,
    });
  }

  const campaignCids = [
    dossier.cid,
    ...nodes.map((n) => n.pubchemCid).filter((c): c is number => !!c && c > 0),
  ];
  const uniqueCids = [...new Set(campaignCids)].slice(0, 24);

  const summary =
    nodes.length <= 1
      ? honestReactionNetworkSummary(dossier, CLEAN_EMPTY_NETWORK)
      : `${nodes.length} nodes · ${edges.length} evidence edges · ${uniqueCids.length} PubChem CID(s) for campaign densify`;

  return {
    cid: dossier.cid,
    centerName,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    campaignCids: uniqueCids,
    summary,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Merge networks from multiple dossiers into one campaign graph.
 */
export function mergeReactionNetworks(
  networks: ReactionNetwork[]
): ReactionNetwork {
  if (!networks.length) {
    return {
      cid: 0,
      centerName: "empty",
      generatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      campaignCids: [],
      summary: "No networks",
      disclaimer: DISCLAIMER,
    };
  }
  const nodes = new Map<string, NetworkNode>();
  const edges: NetworkEdge[] = [];
  const cids = new Set<number>();
  let ei = 0;
  for (const net of networks) {
    for (const n of net.nodes) {
      if (!nodes.has(n.id)) nodes.set(n.id, n);
      if (n.pubchemCid) cids.add(n.pubchemCid);
    }
    for (const e of net.edges) {
      edges.push({ ...e, id: `m:${ei++}:${e.id}` });
    }
  }
  return {
    cid: networks[0]!.cid,
    centerName: `Campaign (${networks.length} centers)`,
    generatedAt: new Date().toISOString(),
    nodes: [...nodes.values()],
    edges: edges.slice(0, 200),
    campaignCids: [...cids].slice(0, 40),
    summary: `Merged ${networks.length} networks · ${nodes.size} nodes · ${edges.length} edges`,
    disclaimer: DISCLAIMER,
  };
}
