/**
 * ORD bulk snippets → local densify enrich + science campaign bridge.
 * User-controlled public ORD text only; never auto-downloads bulk datasets.
 */

import {
  listOrdBulkSnippets,
  type OrdBulkSnippet,
} from "@/lib/api/ordBulk";
import { saveUserSupplement } from "@/lib/idb/userSupplements";
import {
  createCampaign,
  type ScienceCampaign,
} from "@/lib/workspace/campaigns";
import { scoreProcedureWindow } from "@/lib/literature/procedureWindowScore";
import { HUB_INDEX } from "@/lib/data/hubIndex";

export const ORD_BRIDGE_SCHEMA =
  "chemistry-recipes.ord-campaign-bridge.v1" as const;

/**
 * Extract PubChem CID mentions from free-public ORD / reaction text.
 */
export function extractCidsFromOrdText(text: string): number[] {
  const found = new Set<number>();
  const re =
    /(?:pubchem\s*cid|cid|compound)\s*[:=]?\s*(\d{2,9})\b|\bcid\s*(\d{2,9})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1] || m[2]);
    if (Number.isFinite(n) && n > 0 && n < 1e9) found.add(n);
  }
  return [...found];
}

/**
 * Match hub molecule names mentioned in ORD snippet text.
 */
export function matchHubCidsFromText(text: string): Array<{
  cid: number;
  name: string;
}> {
  const lower = text.toLowerCase();
  const hits: Array<{ cid: number; name: string }> = [];
  for (const e of HUB_INDEX) {
    if (lower.includes(e.name.toLowerCase())) {
      hits.push({ cid: e.pubchemCid, name: e.name });
    }
  }
  // de-dupe
  const seen = new Set<number>();
  return hits.filter((h) => {
    if (seen.has(h.cid)) return false;
    seen.add(h.cid);
    return true;
  });
}

export interface OrdSnippetAnalysis {
  snippetId: string;
  query: string;
  chars: number;
  procedureScore: number;
  cids: number[];
  hubMatches: Array<{ cid: number; name: string }>;
  /** Recommended CIDs to attach this text to */
  attachCids: number[];
}

export function analyzeOrdSnippet(s: OrdBulkSnippet): OrdSnippetAnalysis {
  const fromText = extractCidsFromOrdText(s.text);
  const hub = matchHubCidsFromText(s.text + " " + s.query);
  const attach = [
    ...fromText,
    ...hub.map((h) => h.cid),
  ].filter((c, i, a) => a.indexOf(c) === i);
  return {
    snippetId: s.id,
    query: s.query,
    chars: s.chars,
    procedureScore: scoreProcedureWindow(s.text),
    cids: fromText,
    hubMatches: hub,
    attachCids: attach,
  };
}

/**
 * Attach ORD snippet text as local user supplement for densify re-extract.
 */
export function attachOrdSnippetToCid(
  cid: number,
  snippet: OrdBulkSnippet
): { ok: boolean; chars?: number; error?: string } {
  const row = saveUserSupplement(
    cid,
    snippet.text,
    `ORD public snippet · ${snippet.query.slice(0, 40)}`
  );
  if (!row) {
    return { ok: false, error: "Could not save (need CID + ~40 chars)" };
  }
  return { ok: true, chars: row.text.length };
}

/**
 * Create a science campaign from ORD snippets (+ optional center CID).
 */
export function createCampaignFromOrdSnippets(opts: {
  name?: string;
  centerCid?: number;
  centerLabel?: string;
  snippets?: OrdBulkSnippet[];
}): ScienceCampaign | null {
  const snippets = opts.snippets ?? listOrdBulkSnippets();
  if (!snippets.length && !opts.centerCid) return null;

  const labels: Record<string, string> = {};
  const cids: number[] = [];
  if (opts.centerCid && opts.centerCid > 0) {
    cids.push(opts.centerCid);
    if (opts.centerLabel) labels[String(opts.centerCid)] = opts.centerLabel;
  }

  for (const s of snippets) {
    const a = analyzeOrdSnippet(s);
    for (const cid of a.attachCids) {
      cids.push(cid);
      const hub = a.hubMatches.find((h) => h.cid === cid);
      if (hub) labels[String(cid)] = hub.name;
    }
    // Query string may be a molecule name
    const qHub = HUB_INDEX.find(
      (e) => e.name.toLowerCase() === s.query.toLowerCase()
    );
    if (qHub) {
      cids.push(qHub.pubchemCid);
      labels[String(qHub.pubchemCid)] = qHub.name;
    }
  }

  const unique = [...new Set(cids.filter((c) => c > 0))].slice(0, 40);
  if (!unique.length) return null;

  const name =
    opts.name?.trim() ||
    `ORD campaign · ${opts.centerLabel || snippets[0]?.query || "reactions"}`;

  return createCampaign(name, unique, {
    description:
      `From local ORD bulk snippets (${snippets.length}) · free-public reaction text · not GMP`,
    labels,
  });
}

/**
 * Inventory of local ORD snippets for workspace.
 */
export function ordBridgeInventory(query?: string): {
  schema: typeof ORD_BRIDGE_SCHEMA;
  snippets: OrdSnippetAnalysis[];
  uniqueCids: number[];
  totalChars: number;
  summary: string;
} {
  const rows = listOrdBulkSnippets(query);
  const analyses = rows.map(analyzeOrdSnippet);
  const uniqueCids = [
    ...new Set(analyses.flatMap((a) => a.attachCids)),
  ];
  const totalChars = rows.reduce((n, s) => n + s.chars, 0);
  return {
    schema: ORD_BRIDGE_SCHEMA,
    snippets: analyses,
    uniqueCids,
    totalChars,
    summary: rows.length
      ? `ORD index · ${rows.length} snippet(s) · ${totalChars.toLocaleString()} chars · ${uniqueCids.length} linked CID(s)`
      : "No local ORD snippets yet — paste public ORD reaction windows on a live dossier",
  };
}
