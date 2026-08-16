/**
 * Multi-source free-public molecule search.
 * Fan-out: identity APIs + openFDA + KEGG + process literature
 * (Europe PMC, OpenAlex, Crossref, Semantic Scholar, PubMed),
 * then merge/resolve to openable PubChem CIDs when possible.
 */

import { searchPubChem, type PubChemHit } from "@/lib/api/pubchem";
import { fetchChemblByName } from "@/lib/api/chembl";
import { fetchChebiByName } from "@/lib/api/chebi";
import { fetchMyChemByName } from "@/lib/api/mychem";
import { fetchRxNormByName } from "@/lib/api/rxnorm";
import { fetchGsrsByName } from "@/lib/api/gsrs";
import { fetchDrugCentralByName } from "@/lib/api/drugCentral";
import { fetchOpenFdaByName } from "@/lib/api/openFda";
import { fetchKeggByName } from "@/lib/api/kegg";
import { searchEuropePmc } from "@/lib/api/europePmc";
import { searchOpenAlexProcess } from "@/lib/api/openAlex";
import { searchCrossrefProcess } from "@/lib/api/crossref";
import { searchSemanticScholarProcess } from "@/lib/api/semanticScholar";
import { searchPubMedProcess } from "@/lib/api/pubmed";
import { searchArxivProcess } from "@/lib/api/arxiv";
import type { ApiFetchTrace } from "@/lib/api/trace";
import {
  classifyChemicalQuery,
  isStructureOnlyQuery,
  normalizeChemicalQuery,
} from "@/lib/search/queryKind";

export type MultiSourceId =
  | "pubchem"
  | "chembl"
  | "chebi"
  | "mychem"
  | "rxnorm"
  | "gsrs"
  | "drugcentral"
  | "openfda"
  | "kegg"
  | "europepmc"
  | "openalex"
  | "crossref"
  | "semanticscholar"
  | "pubmed"
  | "arxiv";

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
  /** Europe PMC process-chemistry paper count when available */
  processLiteratureCount?: number;
  /** Short free-public note (e.g. KEGG pathway, openFDA form) */
  note?: string;
  /** Salt / form / parent label for search UI honesty */
  formKind?: "parent" | "salt" | "hydrate" | "ester" | "other-form";
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

function normName(n: string): string {
  return n.toLowerCase().trim().replace(/\s+/g, " ");
}

const SALT_FORM_RE =
  /\b(maleate|hydrochloride|hcl|sodium|potassium|mesylate|besylate|tosylate|tartrate|citrate|phosphate|sulfate|sulphate|fumarate|succinate|acetate|hydrate|dihydrate|monohydrate|hemihydrate|besilate|bromide|chloride|iodide|besylate)\b/i;

/** Classify salt/form vs parent for UI chips (no invention — name tokens only). */
export function classifyFormKind(
  name: string,
  query?: string
): MultiSourceHit["formKind"] {
  const n = name.toLowerCase();
  if (SALT_FORM_RE.test(n)) {
    if (/\bhydrate|dihydrate|monohydrate|hemihydrate\b/i.test(n)) return "hydrate";
    return "salt";
  }
  if (/\bester\b/i.test(n)) return "ester";
  const q = (query || "").toLowerCase().trim();
  if (q && n === q) return "parent";
  if (q && n.startsWith(q) && n.length > q.length + 2) return "other-form";
  return undefined;
}

function mergeSources(
  a: MultiSourceRef[],
  b: MultiSourceRef[]
): MultiSourceRef[] {
  const out = [...a];
  for (const s of b) {
    if (!out.some((x) => x.source === s.source && x.externalId === s.externalId)) {
      out.push(s);
    }
  }
  return out;
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
  const sources = mergeSources(prev.sources, partial.sources);
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
    processLiteratureCount: Math.max(
      prev.processLiteratureCount || 0,
      partial.processLiteratureCount || 0
    ) || undefined,
    note: prev.note || partial.note,
  });
}

/**
 * Fold identity-only rows (case variants / same InChIKey without CID) into
 * openable CID rows. Keeps salt/form variants that have their own CID.
 */
function consolidateIdentityHits(hits: MultiSourceHit[]): MultiSourceHit[] {
  const openable = hits
    .filter((h) => h.cid && h.cid > 0)
    .map((h) => ({
      ...h,
      sources: [...h.sources],
      openable: true as boolean,
    }));
  const identityOnly = hits.filter((h) => !h.cid || h.cid <= 0);

  function findTarget(h: MultiSourceHit): MultiSourceHit | undefined {
    if (h.inchiKey) {
      const ik = h.inchiKey.toUpperCase();
      const byIk = openable.find(
        (o) => o.inchiKey && o.inchiKey.toUpperCase() === ik
      );
      if (byIk) return byIk;
    }
    const nn = normName(h.name);
    if (!nn) return undefined;
    return openable.find((o) => normName(o.name) === nn);
  }

  const leftover: MultiSourceHit[] = [];
  for (const h of identityOnly) {
    const t = findTarget(h);
    if (!t) {
      leftover.push(h);
      continue;
    }
    t.sources = mergeSources(t.sources, h.sources);
    t.score = Math.max(t.score, h.score) + 2;
    t.processLiteratureCount =
      Math.max(t.processLiteratureCount || 0, h.processLiteratureCount || 0) ||
      undefined;
    t.note = t.note || h.note;
    t.formula = t.formula || h.formula;
    t.molecularWeight = t.molecularWeight ?? h.molecularWeight;
    t.cas = t.cas || h.cas;
    t.inchiKey = t.inchiKey || h.inchiKey;
    t.unii = t.unii || h.unii;
    // Prefer Title Case / longer display name from PubChem when available
    if (h.name.length > t.name.length) t.name = h.name;
  }

  return [...openable, ...leftover];
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
  const q = normalizeChemicalQuery(query);
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

  const kind = classifyChemicalQuery(q);
  // SMILES / InChI / InChIKey / CID are not names — do not fan out to name
  // APIs or literature (those chips would look like missing ChEMBL/RxNorm).
  if (isStructureOnlyQuery(kind)) {
    const pub = await searchPubChem(q, Math.min(12, limit));
    traces.push(...(pub.traces || []));
    for (const h of pub.hits) mergeHit(map, fromPubChem(h, 10));
    sourceStatus.push({
      source: "pubchem",
      ok: pub.hits.length > 0,
      hitCount: pub.hits.length,
      detail: pub.failure || "structured identifier — PubChem only",
    });
    const hits = [...map.values()]
      .map((h) => ({
        ...h,
        openable: Boolean(h.cid && h.cid > 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return {
      schema: "chemistry-recipes.multi-source-search.v1",
      q,
      hits,
      sourceStatus,
      durationMs: Date.now() - t0,
      note: pub.hits.length
        ? "Structured identifier resolved via PubChem only — name APIs were not queried."
        : pub.failure || "No PubChem hit for this structured identifier.",
      traces: traces.slice(0, 40),
    };
  }

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

  // Second wave: openFDA, KEGG, process literature (+ arXiv preprints)
  const wave2 = await Promise.allSettled([
    fetchOpenFdaByName(q),
    fetchKeggByName(q),
    searchEuropePmc(q, { limit: 6 }),
    searchOpenAlexProcess(q, { limit: 5 }),
    searchCrossrefProcess(q, { limit: 5 }),
    searchSemanticScholarProcess(q, { limit: 5 }),
    searchPubMedProcess(q, { limit: 5 }),
    searchArxivProcess(q, { limit: 4 }),
  ]);

  // openFDA
  const fda = wave2[0];
  if (fda.status === "fulfilled" && fda.value.hits.length > 0) {
    traces.push(...fda.value.traces);
    const h0 = fda.value.hits[0]!;
    const drugName = h0.genericName || h0.brandName || q;
    mergeHit(map, {
      name: drugName,
      sources: [
        {
          source: "openfda",
          label: "openFDA · FDA",
          externalId: h0.id,
          url: h0.url,
        },
      ],
      score: 26,
      openable: false,
      note: [h0.dosageForm, h0.route, h0.manufacturer]
        .filter(Boolean)
        .slice(0, 3)
        .join(" · ") || undefined,
    });
    const r = await searchPubChem(drugName, 3);
    traces.push(...r.traces);
    for (const ph of r.hits) {
      mergeHit(map, {
        ...fromPubChem(ph, 5),
        sources: [
          ...fromPubChem(ph).sources,
          {
            source: "openfda",
            label: "openFDA · FDA",
            externalId: h0.id,
            url: h0.url,
          },
        ],
        note: h0.dosageForm || h0.route,
      });
    }
    sourceStatus.push({
      source: "openfda",
      ok: true,
      hitCount: fda.value.hits.length,
      detail: h0.genericName || h0.brandName,
    });
  } else {
    sourceStatus.push({
      source: "openfda",
      ok: false,
      hitCount: 0,
      detail: fda.status === "rejected" ? String(fda.reason) : "no hit",
    });
  }

  // KEGG
  const kegg = wave2[1];
  if (kegg.status === "fulfilled" && kegg.value.hit) {
    traces.push(...kegg.value.traces);
    const h = kegg.value.hit;
    const pathNote = h.pathways
      .slice(0, 2)
      .map((p) => p.name || p.id)
      .join("; ");
    mergeHit(map, {
      name: h.name.split(";")[0]?.trim() || h.name,
      formula: h.formula,
      sources: [
        {
          source: "kegg",
          label: "KEGG",
          externalId: h.id,
          url: h.url,
        },
      ],
      score: 23,
      openable: false,
      note: pathNote || (h.reactions[0] ? `rxn ${h.reactions[0]}` : undefined),
    });
    const r = await searchPubChem(h.name.split(";")[0]?.trim() || h.name, 2);
    traces.push(...r.traces);
    for (const ph of r.hits) {
      mergeHit(map, {
        ...fromPubChem(ph, 4),
        formula: ph.formula || h.formula,
        sources: [
          ...fromPubChem(ph).sources,
          {
            source: "kegg",
            label: "KEGG",
            externalId: h.id,
            url: h.url,
          },
        ],
        note: pathNote || undefined,
      });
    }
    sourceStatus.push({
      source: "kegg",
      ok: true,
      hitCount: 1,
      detail: h.id,
    });
  } else {
    sourceStatus.push({
      source: "kegg",
      ok: false,
      hitCount: 0,
      detail: kegg.status === "rejected" ? String(kegg.reason) : "no hit",
    });
  }

  /** Attach process-literature sources to name-matching molecule hits */
  function attachProcessLit(
    source: MultiSourceId,
    label: string,
    hits: Array<{ id: string; title: string; url: string; pmid?: string; pmcid?: string; doi?: string }>,
    tracesIn: ApiFetchTrace[]
  ): void {
    if (!hits.length) {
      sourceStatus.push({
        source,
        ok: false,
        hitCount: 0,
        detail: "no hit",
      });
      return;
    }
    traces.push(...tracesIn);
    const nLit = hits.length;
    const top = hits[0]!;
    const ref: MultiSourceRef = {
      source,
      label,
      externalId: top.pmcid || top.pmid || top.doi || top.id,
      url: top.url,
    };
    let attached = false;
    for (const [k, h] of map) {
      if (
        h.name.toLowerCase().includes(q.toLowerCase()) ||
        q.toLowerCase().includes(h.name.toLowerCase().slice(0, 12))
      ) {
        attached = true;
        const sources: MultiSourceRef[] = h.sources.some((s) => s.source === source)
          ? h.sources
          : [...h.sources, ref];
        map.set(k, {
          ...h,
          processLiteratureCount: Math.max(h.processLiteratureCount || 0, nLit),
          score: h.score + Math.min(10, nLit * 2),
          sources,
        });
      }
    }
    if (!attached) {
      // Prefer attaching to best openable hit — never spawn a dead name-only row
      // from literature alone (that caused case-variant search clutter).
      const best = [...map.values()]
        .filter((h) => h.cid && h.cid > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (best) {
        const k = keyOf(best);
        const cur = map.get(k) || best;
        map.set(k, {
          ...cur,
          processLiteratureCount: Math.max(
            cur.processLiteratureCount || 0,
            nLit
          ),
          score: cur.score + Math.min(10, nLit * 2),
          sources: cur.sources.some((s) => s.source === source)
            ? cur.sources
            : [...cur.sources, ref],
        });
      }
    }
    sourceStatus.push({
      source,
      ok: true,
      hitCount: nLit,
      detail: `${nLit} process-relevant papers`,
    });
  }

  // Europe PMC
  const epmc = wave2[2];
  if (epmc.status === "fulfilled" && epmc.value.hits.length > 0) {
    attachProcessLit(
      "europepmc",
      "Europe PMC",
      epmc.value.hits,
      epmc.value.traces
    );
  } else {
    sourceStatus.push({
      source: "europepmc",
      ok: false,
      hitCount: 0,
      detail: epmc.status === "rejected" ? String(epmc.reason) : "no hit",
    });
  }

  // OpenAlex
  const oalex = wave2[3];
  if (oalex.status === "fulfilled" && oalex.value.hits.length > 0) {
    attachProcessLit(
      "openalex",
      "OpenAlex",
      oalex.value.hits,
      oalex.value.traces
    );
  } else {
    sourceStatus.push({
      source: "openalex",
      ok: false,
      hitCount: 0,
      detail: oalex.status === "rejected" ? String(oalex.reason) : "no hit",
    });
  }

  // Crossref
  const xref = wave2[4];
  if (xref.status === "fulfilled" && xref.value.hits.length > 0) {
    attachProcessLit(
      "crossref",
      "Crossref",
      xref.value.hits,
      xref.value.traces
    );
  } else {
    sourceStatus.push({
      source: "crossref",
      ok: false,
      hitCount: 0,
      detail: xref.status === "rejected" ? String(xref.reason) : "no hit",
    });
  }

  // Semantic Scholar
  const s2 = wave2[5];
  if (s2.status === "fulfilled" && s2.value.hits.length > 0) {
    attachProcessLit(
      "semanticscholar",
      "Semantic Scholar",
      s2.value.hits,
      s2.value.traces
    );
  } else {
    sourceStatus.push({
      source: "semanticscholar",
      ok: false,
      hitCount: 0,
      detail: s2.status === "rejected" ? String(s2.reason) : "no hit",
    });
  }

  // PubMed (NCBI)
  const pm = wave2[6];
  if (pm.status === "fulfilled" && pm.value.hits.length > 0) {
    attachProcessLit(
      "pubmed",
      "PubMed · NCBI",
      pm.value.hits,
      pm.value.traces
    );
  } else {
    sourceStatus.push({
      source: "pubmed",
      ok: false,
      hitCount: 0,
      detail: pm.status === "rejected" ? String(pm.reason) : "no hit",
    });
  }

  // arXiv preprints
  const arxiv = wave2[7];
  if (arxiv.status === "fulfilled" && arxiv.value.hits.length > 0) {
    attachProcessLit(
      "arxiv",
      "arXiv",
      arxiv.value.hits,
      arxiv.value.traces
    );
  } else {
    sourceStatus.push({
      source: "arxiv",
      ok: false,
      hitCount: 0,
      detail: arxiv.status === "rejected" ? String(arxiv.reason) : "no hit",
    });
  }

  // Fold case / InChIKey identity-only clones into openable CID rows
  const hits = consolidateIdentityHits([...map.values()])
    .map((h) => {
      const formKind = classifyFormKind(h.name, q);
      const parentBoost =
        formKind === "parent" || (!formKind && normName(h.name) === normName(q))
          ? 8
          : formKind === "salt" || formKind === "hydrate"
            ? -4
            : 0;
      return {
        ...h,
        formKind,
        note:
          h.note ||
          (formKind === "salt"
            ? "Salt / form variant"
            : formKind === "hydrate"
              ? "Hydrate form"
              : formKind === "ester"
                ? "Ester form"
                : undefined),
        openable: Boolean(h.cid && h.cid > 0),
        score:
          h.score +
          (h.cid ? 15 : 0) +
          h.sources.length * 2 +
          Math.min(10, (h.processLiteratureCount || 0) * 1.5) +
          parentBoost,
      };
    })
    .sort((a, b) => {
      if (a.openable !== b.openable) return a.openable ? -1 : 1;
      // Prefer parent drug name matching query over salts
      const ap = a.formKind === "salt" || a.formKind === "hydrate" ? 1 : 0;
      const bp = b.formKind === "salt" || b.formKind === "hydrate" ? 1 : 0;
      if (ap !== bp) return ap - bp;
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
