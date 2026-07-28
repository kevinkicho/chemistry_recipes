/**
 * Multi-source free-public molecule search.
 * Fan-out: PubChem + ChEMBL + ChEBI + MyChem + RxNorm + GSRS + DrugCentral,
 * then merge/resolve to openable PubChem CIDs when possible.
 */

import { searchPubChem, type PubChemHit } from "@/lib/api/pubchem";
import { fetchChemblByName } from "@/lib/api/chembl";
import { fetchChebiByName } from "@/lib/api/chebi";
import { fetchMyChemByName } from "@/lib/api/mychem";
import { fetchRxNormByName } from "@/lib/api/rxnorm";
import { fetchGsrsByName } from "@/lib/api/gsrs";
import { fetchDrugCentralByName } from "@/lib/api/drugCentral";
import { resolveLocalSearchHits } from "@/lib/data/searchLocalIndex";
import type { ApiFetchTrace } from "@/lib/api/trace";

export type MultiSourceId =
  | "local"
  | "pubchem"
  | "chembl"
  | "chebi"
  | "mychem"
  | "rxnorm"
  | "gsrs"
  | "drugcentral";

export interface MultiSourceRef {
  source: MultiSourceId;
  label: string;
  externalId?: string;
  url?: string;
}

export interface MultiSourceHit {
  /** Openable live dossier when resolved */
  cid?: number;
  name: string;
  formula?: string;
  molecularWeight?: number;
  cas?: string;
  inchiKey?: string;
  unii?: string;
  sources: MultiSourceRef[];
  /** Higher = better match for ranking */
  score: number;
  /** True when CID is known / resolved for live dossier */
  openable: boolean;
}

export interface MultiSourceSearchResult {
  schema: "chemistry-recipes.multi-source-search.v1";
  q: string;
  hits: MultiSourceHit[];
  sourceStatus: Array<{
    source: MultiSourceId;
    ok: boolean;
    hitCount: number;
    detail?: string;
  }>;
  durationMs: number;
  note?: string;
  traces?: ApiFetchTrace[];
}

function keyOf(h: {
  cid?: number;
  inchiKey?: string;
  unii?: string;
  cas?: string;
  name: string;
}): string {
  if (h.cid && h.cid > 0) return `cid:${h.cid}`;
  if (h.inchiKey) return `ik:${h.inchiKey.toUpperCase()}`;
  if (h.unii) return `unii:${h.unii.toUpperCase()}`;
  if (h.cas) return `cas:${h.cas}`;
  return `name:${h.name.toLowerCase().trim()}`;
}

function mergeHit(
  map: Map<string, MultiSourceHit>,
  partial: MultiSourceHit
): void {
  const k = keyOf(partial);
  const prev = map.get(k);
  if (!prev) {
    map.set(k, partial);
    return;
  }
  const sources = [...prev.sources];
  for (const s of partial.sources) {
    if (!sources.some((x) => x.source === s.source && x.externalId === s.externalId)) {
      sources.push(s);
    }
  }
  map.set(k, {
    cid: prev.cid || partial.cid,
    name: prev.name.length >= partial.name.length ? prev.name : partial.name,
    formula: prev.formula || partial.formula,
    molecularWeight: prev.molecularWeight ?? partial.molecularWeight,
    cas: prev.cas || partial.cas,
    inchiKey: prev.inchiKey || partial.inchiKey,
    unii: prev.unii || partial.unii,
    sources,
    score: Math.max(prev.score, partial.score) + Math.min(8, sources.length * 2),
    openable: Boolean(prev.cid || partial.cid),
  });
}

function fromPubChem(h: PubChemHit, boost = 0): MultiSourceHit {
  return {
    cid: h.cid,
    name: h.name,
    formula: h.formula,
    molecularWeight: h.molecularWeight,
    cas: h.cas,
    inchiKey: h.inchiKey,
    sources: [
      {
        source: "pubchem",
        label: "PubChem · NIH",
        externalId: String(h.cid),
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${h.cid}`,
      },
    ],
    score: 40 + boost,
    openable: true,
  };
}

/**
 * Parallel multi-source free-public search with CID merge.
 */
export async function multiSourceSearch(
  query: string,
  limit = 16
): Promise<MultiSourceSearchResult> {
  const q = query.trim();
  const t0 = Date.now();
  if (!q) {
    return {
      schema: "chemistry-recipes.multi-source-search.v1",
      q,
      hits: [],
      sourceStatus: [],
      durationMs: 0,
    };
  }

  const map = new Map<string, MultiSourceHit>();
  const sourceStatus: MultiSourceSearchResult["sourceStatus"] = [];
  const traces: ApiFetchTrace[] = [];

  // Local catalog first
  const local = resolveLocalSearchHits(q, limit);
  for (const h of local) {
    mergeHit(map, {
      cid: h.cid,
      name: h.name,
      cas: h.cas,
      sources: [
        {
          source: "local",
          label: "Local hub / package",
          externalId: String(h.cid),
        },
      ],
      score: 50,
      openable: true,
    });
  }
  sourceStatus.push({
    source: "local",
    ok: local.length > 0,
    hitCount: local.length,
  });

  // Parallel free-public sources (bounded timeouts via each client)
  const tasks = await Promise.allSettled([
    searchPubChem(q, Math.min(12, limit)),
    fetchChemblByName(q),
    fetchChebiByName(q),
    fetchMyChemByName(q),
    fetchRxNormByName(q),
    fetchGsrsByName(q),
    fetchDrugCentralByName(q),
  ]);

  // PubChem
  const pub = tasks[0];
  if (pub.status === "fulfilled") {
    traces.push(...(pub.value.traces || []));
    for (const h of pub.value.hits) mergeHit(map, fromPubChem(h, 10));
    sourceStatus.push({
      source: "pubchem",
      ok: pub.value.hits.length > 0,
      hitCount: pub.value.hits.length,
      detail: pub.value.failure || undefined,
    });
  } else {
    sourceStatus.push({
      source: "pubchem",
      ok: false,
      hitCount: 0,
      detail: String(pub.reason),
    });
  }

  // ChEMBL
  const chembl = tasks[1];
  if (chembl.status === "fulfilled" && chembl.value.molecule) {
    traces.push(...chembl.value.traces);
    const m = chembl.value.molecule;
    mergeHit(map, {
      name: m.prefName || q,
      formula: m.molecularFormula,
      molecularWeight: m.molecularWeight,
      inchiKey: m.inchiKey,
      sources: [
        {
          source: "chembl",
          label: "ChEMBL · EMBL-EBI",
          externalId: m.chemblId,
          url: m.url,
        },
      ],
      score: 28,
      openable: false,
    });
    // Resolve name → CID via PubChem if missing
    if (m.prefName || m.inchiKey) {
      const r = await searchPubChem(m.inchiKey || m.prefName || q, 3);
      traces.push(...r.traces);
      for (const h of r.hits) {
        mergeHit(map, {
          ...fromPubChem(h, 5),
          sources: [
            ...fromPubChem(h).sources,
            {
              source: "chembl",
              label: "ChEMBL · EMBL-EBI",
              externalId: m.chemblId,
              url: m.url,
            },
          ],
        });
      }
    }
    sourceStatus.push({
      source: "chembl",
      ok: true,
      hitCount: 1,
      detail: m.chemblId,
    });
  } else {
    sourceStatus.push({
      source: "chembl",
      ok: false,
      hitCount: 0,
      detail:
        chembl.status === "rejected" ? String(chembl.reason) : "no hit",
    });
  }

  // ChEBI
  const chebi = tasks[2];
  if (chebi.status === "fulfilled" && chebi.value.hit) {
    traces.push(...chebi.value.traces);
    const h = chebi.value.hit;
    mergeHit(map, {
      name: h.name,
      formula: h.formula,
      sources: [
        {
          source: "chebi",
          label: "ChEBI · EMBL-EBI",
          externalId: h.chebiId,
          url: h.url,
        },
      ],
      score: 24,
      openable: false,
    });
    const r = await searchPubChem(h.name, 2);
    traces.push(...r.traces);
    for (const ph of r.hits) {
      mergeHit(map, {
        ...fromPubChem(ph, 4),
        sources: [
          ...fromPubChem(ph).sources,
          {
            source: "chebi",
            label: "ChEBI · EMBL-EBI",
            externalId: h.chebiId,
            url: h.url,
          },
        ],
      });
    }
    sourceStatus.push({
      source: "chebi",
      ok: true,
      hitCount: 1,
      detail: h.chebiId,
    });
  } else {
    sourceStatus.push({
      source: "chebi",
      ok: false,
      hitCount: 0,
      detail: chebi.status === "rejected" ? String(chebi.reason) : "no hit",
    });
  }

  // MyChem
  const mychem = tasks[3];
  if (mychem.status === "fulfilled" && mychem.value.hit) {
    traces.push(...mychem.value.traces);
    const h = mychem.value.hit;
    const cid = h.pubchemCid;
    mergeHit(map, {
      cid: cid && cid > 0 ? cid : undefined,
      name: h.name || q,
      unii: h.unii,
      cas: h.cas,
      inchiKey: h.inchikey,
      sources: [
        {
          source: "mychem",
          label: "MyChem.info",
          externalId: h.id,
          url: h.url,
        },
      ],
      score: cid ? 36 : 22,
      openable: Boolean(cid),
    });
    if (!cid && h.name) {
      const r = await searchPubChem(h.name, 2);
      traces.push(...r.traces);
      for (const ph of r.hits) mergeHit(map, fromPubChem(ph, 3));
    }
    sourceStatus.push({
      source: "mychem",
      ok: true,
      hitCount: 1,
      detail: h.summary,
    });
  } else {
    sourceStatus.push({
      source: "mychem",
      ok: false,
      hitCount: 0,
      detail: mychem.status === "rejected" ? String(mychem.reason) : "no hit",
    });
  }

  // RxNorm
  const rx = tasks[4];
  if (rx.status === "fulfilled" && rx.value.hit) {
    traces.push(...rx.value.traces);
    const h = rx.value.hit;
    mergeHit(map, {
      name: h.name,
      sources: [
        {
          source: "rxnorm",
          label: "RxNorm · NLM",
          externalId: h.rxcui,
          url: h.url,
        },
      ],
      score: 20,
      openable: false,
    });
    const r = await searchPubChem(h.name, 2);
    traces.push(...r.traces);
    for (const ph of r.hits) {
      mergeHit(map, {
        ...fromPubChem(ph, 3),
        sources: [
          ...fromPubChem(ph).sources,
          {
            source: "rxnorm",
            label: "RxNorm · NLM",
            externalId: h.rxcui,
            url: h.url,
          },
        ],
      });
    }
    sourceStatus.push({
      source: "rxnorm",
      ok: true,
      hitCount: 1,
      detail: `RxCUI ${h.rxcui}`,
    });
  } else {
    sourceStatus.push({
      source: "rxnorm",
      ok: false,
      hitCount: 0,
      detail: rx.status === "rejected" ? String(rx.reason) : "no hit",
    });
  }

  // GSRS
  const gsrs = tasks[5];
  if (gsrs.status === "fulfilled" && gsrs.value.hit) {
    traces.push(...gsrs.value.traces);
    const h = gsrs.value.hit;
    mergeHit(map, {
      name: h.name,
      unii: h.unii,
      sources: [
        {
          source: "gsrs",
          label: "GSRS · FDA",
          externalId: h.unii || h.uuid,
          url: h.url,
        },
      ],
      score: 22,
      openable: false,
    });
    const r = await searchPubChem(h.unii || h.name, 2);
    traces.push(...r.traces);
    for (const ph of r.hits) {
      mergeHit(map, {
        ...fromPubChem(ph, 4),
        unii: h.unii || ph.cas,
        sources: [
          ...fromPubChem(ph).sources,
          {
            source: "gsrs",
            label: "GSRS · FDA",
            externalId: h.unii || h.uuid,
            url: h.url,
          },
        ],
      });
    }
    sourceStatus.push({
      source: "gsrs",
      ok: true,
      hitCount: 1,
      detail: h.unii,
    });
  } else {
    sourceStatus.push({
      source: "gsrs",
      ok: false,
      hitCount: 0,
      detail: gsrs.status === "rejected" ? String(gsrs.reason) : "no hit",
    });
  }

  // DrugCentral
  const dc = tasks[6];
  if (dc.status === "fulfilled" && dc.value.hit) {
    traces.push(...dc.value.traces);
    const h = dc.value.hit;
    mergeHit(map, {
      name: h.name,
      cas: h.cas,
      unii: h.unii,
      sources: [
        {
          source: "drugcentral",
          label: "DrugCentral",
          externalId: h.id,
          url: h.url,
        },
      ],
      score: 18,
      openable: false,
    });
    const r = await searchPubChem(h.cas || h.name, 2);
    traces.push(...r.traces);
    for (const ph of r.hits) {
      mergeHit(map, {
        ...fromPubChem(ph, 3),
        sources: [
          ...fromPubChem(ph).sources,
          {
            source: "drugcentral",
            label: "DrugCentral",
            externalId: h.id,
            url: h.url,
          },
        ],
      });
    }
    sourceStatus.push({
      source: "drugcentral",
      ok: true,
      hitCount: 1,
      detail: h.id,
    });
  } else {
    sourceStatus.push({
      source: "drugcentral",
      ok: false,
      hitCount: 0,
      detail: dc.status === "rejected" ? String(dc.reason) : "no hit",
    });
  }

  // Prefer openable CIDs; still surface multi-source identity rows without CID
  const hits = [...map.values()]
    .map((h) => ({
      ...h,
      openable: Boolean(h.cid && h.cid > 0),
      score: h.score + (h.cid ? 15 : 0) + h.sources.length * 2,
    }))
    .sort((a, b) => {
      if (a.openable !== b.openable) return a.openable ? -1 : 1;
      return b.score - a.score || (a.cid || 0) - (b.cid || 0);
    })
    .slice(0, limit);

  const okSources = sourceStatus.filter((s) => s.ok).map((s) => s.source);
  const note =
    okSources.length > 1
      ? `Merged ${okSources.length} free-public sources: ${okSources.join(", ")}`
      : okSources.length === 1
        ? `Hits from ${okSources[0]} only — other free sources returned empty or timed out`
        : "No free-public hits from fan-out sources";

  return {
    schema: "chemistry-recipes.multi-source-search.v1",
    q,
    hits,
    sourceStatus,
    durationMs: Date.now() - t0,
    note,
    traces: traces.slice(0, 40),
  };
}
