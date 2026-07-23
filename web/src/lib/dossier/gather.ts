/**
 * Multi-source free-public evidence gather for a PubChem CID.
 * PubChem is only one identity anchor — ChEMBL, MyChem, openFDA, RxNorm,
 * Crossref, KEGG, Europe PMC, OpenAlex, PatentsView also feed the dossier.
 */

import { getPubChemCompound, type PubChemHit } from "@/lib/api/pubchem";
import { fetchPubChemView } from "@/lib/api/pubchemView";
import { searchEuropePmc, type LiteratureHit } from "@/lib/api/europePmc";
import { searchOpenAlexProcess } from "@/lib/api/openAlex";
import {
  searchPatentsView,
  searchPatentLiterature,
} from "@/lib/api/patentsView";
import { fetchChemblByName } from "@/lib/api/chembl";
import { fetchMyChemByName } from "@/lib/api/mychem";
import { fetchOpenFdaByName } from "@/lib/api/openFda";
import { fetchRxNormByName } from "@/lib/api/rxnorm";
import { searchCrossrefProcess } from "@/lib/api/crossref";
import { fetchKeggByName } from "@/lib/api/kegg";
import { fetchCompToxByName } from "@/lib/api/comptox";
import { fetchDailyMedByName } from "@/lib/api/dailyMed";
import { searchSemanticScholarProcess } from "@/lib/api/semanticScholar";
import { politeDelay } from "@/lib/api/rateLimit";
import { slimTraces, type ApiFetchTrace } from "@/lib/api/trace";
import type { SourceRef } from "@/lib/types/process";
import type {
  CompoundEvidence,
  ExternalAnnotation,
} from "@/lib/dossier/types";
import { scoreCompoundEvidence } from "@/lib/dossier/evidenceScore";
import { extractProcessFacts } from "@/lib/dossier/processFacts";

function mergeLiterature(lists: LiteratureHit[][]): LiteratureHit[] {
  const map = new Map<string, LiteratureHit>();
  for (const list of lists) {
    for (const h of list) {
      const key =
        h.doi?.toLowerCase() ||
        h.pmid ||
        h.pmcid ||
        h.id ||
        h.title.slice(0, 80).toLowerCase();
      if (!map.has(key)) map.set(key, h);
    }
  }
  return [...map.values()];
}

export async function gatherCompoundEvidence(
  cid: number
): Promise<CompoundEvidence> {
  const traces: ApiFetchTrace[] = [];
  const sourceRefs: SourceRef[] = [];
  const fetchErrors: string[] = [];
  const annotations: ExternalAnnotation[] = [];

  let identity: PubChemHit | null = null;

  // Wave 1: PubChem identity + view (still the CID anchor for this app route)
  const [identityResult, viewResult] = await Promise.all([
    getPubChemCompound(cid),
    fetchPubChemView(cid),
  ]);

  identity = identityResult.hit;
  traces.push(...identityResult.traces);
  traces.push(...viewResult.traces);

  if (!identity) {
    fetchErrors.push("PubChem identity properties unavailable or missing.");
  }

  const name = identity?.name || viewResult.title || `CID ${cid}`;

  await politeDelay(40);

  // Wave 2: multi-source free public APIs (not PubChem)
  const [
    litResult,
    openAlexResult,
    crossrefResult,
    semanticResult,
    pvResult,
    patentLitResult,
    chemblResult,
    mychemResult,
    openFdaResult,
    rxnormResult,
    keggResult,
    comptoxResult,
    dailyMedResult,
  ] = await Promise.all([
    searchEuropePmc(name, { limit: 12 }),
    searchOpenAlexProcess(name, { limit: 6 }),
    searchCrossrefProcess(name, { limit: 6 }),
    searchSemanticScholarProcess(name, { limit: 6 }),
    searchPatentsView(name, { limit: 10 }),
    searchPatentLiterature(name, { limit: 8 }),
    fetchChemblByName(name),
    fetchMyChemByName(name),
    fetchOpenFdaByName(name),
    fetchRxNormByName(name),
    fetchKeggByName(name),
    fetchCompToxByName(name),
    fetchDailyMedByName(name),
  ]);

  traces.push(...litResult.traces);
  traces.push(...openAlexResult.traces);
  traces.push(...crossrefResult.traces);
  traces.push(...semanticResult.traces);
  traces.push(...pvResult.traces);
  traces.push(...patentLitResult.traces);
  traces.push(...chemblResult.traces);
  traces.push(...mychemResult.traces);
  traces.push(...openFdaResult.traces);
  traces.push(...rxnormResult.traces);
  traces.push(...keggResult.traces);
  traces.push(...comptoxResult.traces);
  traces.push(...dailyMedResult.traces);

  const literature = mergeLiterature([
    litResult.hits,
    openAlexResult.hits,
    crossrefResult.hits,
    semanticResult.hits,
  ]).slice(0, 28);

  const patentMap = new Map<string, (typeof pvResult.hits)[0]>();
  for (const p of pvResult.hits) patentMap.set(p.id, p);
  for (const p of patentLitResult.hits) {
    if (!patentMap.has(p.id)) patentMap.set(p.id, p);
  }
  const patents = [...patentMap.values()].slice(0, 14);

  // ── Map non-PubChem hits → annotations + sourceRefs ─────────────
  sourceRefs.push({
    type: "api",
    id: `pubchem:${cid}`,
    label: "PubChem compound record",
    url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    note: "NIH/NCBI free public compound page (route anchor)",
  });

  if (chemblResult.molecule) {
    const m = chemblResult.molecule;
    const mech = chemblResult.mechanisms
      .map((x) => x.mechanismOfAction)
      .filter(Boolean)
      .slice(0, 4)
      .join("; ");
    annotations.push({
      source: "ChEMBL",
      organization: "EMBL-EBI",
      kind: "mechanism",
      title: m.prefName || m.chemblId,
      summary:
        [
          m.chemblId,
          m.maxPhase != null ? `max clinical phase ${m.maxPhase}` : null,
          mech || null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      url: m.url,
      endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule",
      fields: {
        chemblId: m.chemblId,
        ...(m.molecularFormula ? { formula: m.molecularFormula } : {}),
        ...(m.inchiKey ? { inchiKey: m.inchiKey } : {}),
        ...(mech ? { mechanisms: mech } : {}),
      },
    });
    sourceRefs.push({
      type: "api",
      id: `chembl:${m.chemblId}`,
      label: `ChEMBL ${m.chemblId}`,
      url: m.url,
      note: "EMBL-EBI free public molecule + mechanism API",
    });
  }

  if (mychemResult.hit) {
    const h = mychemResult.hit;
    annotations.push({
      source: "MyChem.info",
      organization: "BioThings",
      kind: "identity",
      title: h.name || name,
      summary: h.summary,
      url: h.url,
      endpointUrl: "https://mychem.info/v1/query",
      fields: {
        ...(h.unii ? { unii: h.unii } : {}),
        ...(h.chemblId ? { chemblId: h.chemblId } : {}),
        ...(h.drugbankId ? { drugbank: h.drugbankId } : {}),
      },
    });
    sourceRefs.push({
      type: "api",
      id: `mychem:${h.id}`,
      label: "MyChem.info annotation",
      url: h.url,
      note: "BioThings free aggregated chemical annotation",
    });
  }

  if (rxnormResult.hit) {
    const r = rxnormResult.hit;
    annotations.push({
      source: "RxNorm",
      organization: "NLM (NIH)",
      kind: "identity",
      title: r.name,
      summary: `RxCUI ${r.rxcui}${r.tty ? ` · ${r.tty}` : ""}`,
      url: r.url,
      endpointUrl: "https://rxnav.nlm.nih.gov/REST",
      fields: { rxcui: r.rxcui, ...(r.tty ? { tty: r.tty } : {}) },
    });
    sourceRefs.push({
      type: "api",
      id: `rxnorm:${r.rxcui}`,
      label: `RxNorm ${r.rxcui}`,
      url: r.url,
      note: "NLM free drug name normalization API",
    });
  }

  for (const f of openFdaResult.hits) {
    annotations.push({
      source: f.source === "openfda-label" ? "openFDA Label" : "openFDA Drugs@FDA",
      organization: "U.S. FDA",
      kind: "regulatory",
      title: f.brandName || f.genericName || name,
      summary: [
        f.genericName,
        f.manufacturer,
        f.dosageForm,
        f.route,
        f.indications?.slice(0, 200),
        f.description?.slice(0, 200),
      ]
        .filter(Boolean)
        .join(" · "),
      url: f.url,
      endpointUrl:
        f.source === "openfda-label"
          ? "https://api.fda.gov/drug/label.json"
          : "https://api.fda.gov/drug/drugsfda.json",
      fields: {
        ...(f.genericName ? { generic: f.genericName } : {}),
        ...(f.brandName ? { brand: f.brandName } : {}),
        ...(f.manufacturer ? { sponsor: f.manufacturer } : {}),
      },
    });
  }
  if (openFdaResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `openfda:${cid}`,
      label: "openFDA drug label / Drugs@FDA",
      url: "https://open.fda.gov/",
      note: "U.S. FDA free public drug APIs",
    });
  }

  if (keggResult.hit) {
    const k = keggResult.hit;
    annotations.push({
      source: "KEGG",
      organization: "KEGG / Kyoto University",
      kind: "pathway",
      title: `${k.name} (${k.id})`,
      summary: [
        k.formula && `Formula ${k.formula}`,
        k.pathways.length
          ? `Pathways: ${k.pathways
              .slice(0, 4)
              .map((p) => p.name)
              .join("; ")}`
          : null,
        k.reactions.length
          ? `Reactions: ${k.reactions.slice(0, 6).join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      url: k.url,
      endpointUrl: "https://rest.kegg.jp",
      fields: {
        keggId: k.id,
        ...(k.formula ? { formula: k.formula } : {}),
        pathways: String(k.pathways.length),
        reactions: String(k.reactions.length),
      },
    });
    sourceRefs.push({
      type: "api",
      id: `kegg:${k.id}`,
      label: `KEGG ${k.id}`,
      url: k.url,
      note: "KEGG free REST compound / pathway API",
    });
  }

  if (comptoxResult.hit) {
    const c = comptoxResult.hit;
    annotations.push({
      source: "CompTox",
      organization: "EPA",
      kind: "hazards",
      title: c.preferredName || name,
      summary: c.summary,
      url: c.url,
      endpointUrl: "https://comptox.epa.gov/dashboard-api",
      fields: {
        ...(c.dtxsid ? { dtxsid: c.dtxsid } : {}),
        ...(c.casrn ? { cas: c.casrn } : {}),
      },
    });
    sourceRefs.push({
      type: "api",
      id: `comptox:${c.dtxsid || cid}`,
      label: "EPA CompTox",
      url: c.url,
      note: "EPA free CompTox dashboard API",
    });
  }

  for (const d of dailyMedResult.hits.slice(0, 3)) {
    annotations.push({
      source: "DailyMed",
      organization: "NLM (NIH)",
      kind: "regulatory",
      title: d.title,
      summary: d.publishedDate
        ? `SPL setid ${d.setId} · published ${d.publishedDate}`
        : `SPL setid ${d.setId}`,
      url: d.url,
      endpointUrl: "https://dailymed.nlm.nih.gov/dailymed/services/v2",
      fields: { setId: d.setId },
    });
  }
  if (dailyMedResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `dailymed:${cid}`,
      label: "DailyMed SPL",
      url: "https://dailymed.nlm.nih.gov/",
      note: "NLM free labeling API (formulation context)",
    });
  }

  for (const hit of literature.slice(0, 18)) {
    sourceRefs.push({
      type: "literature",
      id: hit.id,
      label: hit.title.slice(0, 120),
      url: hit.url,
      note:
        [hit.source, hit.journal, hit.year].filter(Boolean).join(" · ") ||
        "Literature",
    });
  }

  for (const p of patents) {
    sourceRefs.push({
      type: "patent",
      id: p.id,
      label: p.title.slice(0, 120),
      url: p.url,
      note: p.patentNumber,
    });
  }

  // Literature source notes
  sourceRefs.push({
    type: "api",
    id: `europepmc:${cid}`,
    label: "Europe PMC",
    url: "https://europepmc.org/",
    note: litResult.query.slice(0, 160),
  });
  sourceRefs.push({
    type: "api",
    id: `openalex:${cid}`,
    label: "OpenAlex",
    url: "https://openalex.org/",
    note: openAlexResult.query.slice(0, 120),
  });
  sourceRefs.push({
    type: "api",
    id: `crossref:${cid}`,
    label: "Crossref",
    url: "https://www.crossref.org/",
    note: crossrefResult.query.slice(0, 120),
  });
  if (semanticResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `semanticscholar:${cid}`,
      label: "Semantic Scholar",
      url: "https://www.semanticscholar.org/",
      note: semanticResult.query.slice(0, 120),
    });
  }

  const base: CompoundEvidence = {
    cid,
    identity,
    view: viewResult,
    literature,
    patents,
    annotations,
    literatureQuery: [
      litResult.query,
      openAlexResult.query,
      crossrefResult.query,
      semanticResult.query,
    ]
      .filter(Boolean)
      .join(" || "),
    patentsQuery: pvResult.query || patentLitResult.query,
    patentsNote: [pvResult.note, patentLitResult.note]
      .filter(Boolean)
      .join(" "),
    traces: slimTraces(traces),
    sourceRefs,
    fetchErrors,
  };

  const processFacts = extractProcessFacts(base);
  const evidence: CompoundEvidence = { ...base, processFacts };
  void scoreCompoundEvidence(evidence);

  return evidence;
}
