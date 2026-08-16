/**
 * Multi-source free-public evidence gather for a PubChem CID.
 * Identity graph (UniChem/ChEBI/GSRS) + process literature (EPMC/PubMed/arXiv)
 * + patents + OrgSyn + ORD + reaction DBs feed procedure density.
 */

import { getPubChemCompound, type PubChemHit } from "@/lib/api/pubchem";
import { fetchPubChemView } from "@/lib/api/pubchemView";
import {
  searchEuropePmc,
  enrichLiteratureWithOaFullText,
  type LiteratureHit,
} from "@/lib/api/europePmc";
import { searchOpenAlexProcess } from "@/lib/api/openAlex";
import {
  searchPatentsView,
  searchPatentLiterature,
  isStructuredPatentHit,
  filterStructuredPatents,
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
import {
  fetchPubchemPatentIds,
  patentHitsFromPubchemIds,
} from "@/lib/api/pubchemPatents";
import { fetchOrdContext } from "@/lib/api/ord";
import {
  searchEuropePmcPatents,
  enrichPatentHitsWithEpmc,
} from "@/lib/api/patentFullText";
import { densifyUsPatentsWithPubchem } from "@/lib/api/usptoFullText";
import { fetchRheaByName } from "@/lib/api/rhea";
import { fetchUnichemByPubchemCid } from "@/lib/api/unichem";
import { fetchChebiByName } from "@/lib/api/chebi";
import { fetchGsrsByName } from "@/lib/api/gsrs";
import { searchPubMedProcess } from "@/lib/api/pubmed";
import { searchArxivProcess } from "@/lib/api/arxiv";
import { fetchOrgSynByName } from "@/lib/api/orgsyn";
import { fetchReactomeByName } from "@/lib/api/reactome";
import { fetchWikiPathwaysByName } from "@/lib/api/wikipathways";
import { fetchPathwayCommonsByName } from "@/lib/api/pathwayCommons";
import { fetchMassBankByName, isHarvestedMassBankRecord } from "@/lib/api/massbank";
import { fetchDrugCentralByName } from "@/lib/api/drugCentral";
import { fetchClinicalTrialsByName } from "@/lib/api/clinicalTrials";
import { fetchPubchemClassifications } from "@/lib/api/pubchemClassifications";
import { politeDelay } from "@/lib/api/rateLimit";
import { slimTraces, type ApiFetchTrace } from "@/lib/api/trace";
import type { SourceRef } from "@/lib/types/process";
import type {
  CompoundEvidence,
  ExternalAnnotation,
  ProcedureExcerpt,
} from "@/lib/dossier/types";
import { scoreCompoundEvidence } from "@/lib/dossier/evidenceScore";
import { extractProcessFacts } from "@/lib/dossier/processFacts";
import { annotationsToProcedureExcerpts } from "@/lib/dossier/annotationExcerpts";
import {
  getCachedEvidence,
  putCachedEvidence,
  mergeEvidencePreferDense,
  pruneEvidenceCacheDisk,
} from "@/lib/dossier/serverEvidenceCache";
import {
  countSoftFailures,
  createSoftRunner,
  sourceNeedsRetry,
} from "@/lib/dossier/gatherResilience";
import {
  literatureToCapturedSourceRefs,
  patentToCapturedSourceRefs,
} from "@/lib/dossier/deepDensify";
import { runApiHarvestAgent } from "@/lib/frontier/apiAgent";
import {
  gatherEtiquetteSnapshot,
  mapSoftWave,
  recommendedInterWaveDelayMs,
} from "@/lib/dossier/gatherAdaptive";

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

/**
 * Durable gather: live multi-API harvest + merge with server evidence cache +
 * second densify pass when procedure text is thin. Survives flaky NIH/egress.
 */
export async function gatherCompoundEvidence(
  cid: number,
  opts?: { force?: boolean }
): Promise<CompoundEvidence> {
  const prior = opts?.force ? null : getCachedEvidence(cid);
  let live: CompoundEvidence;
  try {
    live = await gatherCompoundEvidenceLive(cid);
  } catch (e) {
    if (prior) {
      const msg = e instanceof Error ? e.message : "live gather failed";
      return {
        ...prior,
        processFacts: prior.processFacts ?? extractProcessFacts(prior),
        fetchErrors: [
          ...(prior.fetchErrors || []),
          `Live gather failed (${msg}) — serving durable server evidence cache.`,
        ],
      };
    }
    throw e;
  }

  let merged = mergeEvidencePreferDense(live, prior);

  // API harvest agent owns densify / retry / re-extract / score decisions.
  // Soft-fail rails live inside tools; no hardcoded status→retry trees here.
  try {
    const agent = await runApiHarvestAgent(merged, {
      // LLM planner when Ollama configured; local tool planner otherwise
      useLlm: true,
    });
    merged = agent.evidence;
  } catch (e) {
    merged = {
      ...merged,
      processFacts: merged.processFacts ?? extractProcessFacts(merged),
      fetchErrors: [
        ...(merged.fetchErrors || []),
        `api-agent failed: ${e instanceof Error ? e.message : "error"} — using live+cache merge only`,
      ].slice(0, 80),
    };
  }

  const softFails = countSoftFailures(merged.fetchErrors);
  merged = {
    ...merged,
    processFacts: merged.processFacts ?? extractProcessFacts(merged),
    fetchErrors: [
      ...(merged.fetchErrors || []),
      softFails > 0
        ? `durable-gather · ${softFails} soft/api fail note(s) · agent-orchestrated recovery`
        : "durable-gather · api-agent harvest complete",
    ].filter(Boolean) as string[],
  };
  putCachedEvidence(merged);
  pruneEvidenceCacheDisk();
  void scoreCompoundEvidence(merged);
  return merged;
}

/** Live network harvest only (no cache merge). */
export async function gatherCompoundEvidenceLive(
  cid: number
): Promise<CompoundEvidence> {
  const traces: ApiFetchTrace[] = [];
  const sourceRefs: SourceRef[] = [];
  const fetchErrors: string[] = [];
  const annotations: ExternalAnnotation[] = [];
  /** Soft-fail never aborts siblings; always records label + synthetic trace. */
  const soft = createSoftRunner({ fetchErrors, traces });

  let identity: PubChemHit | null = null;

  // Wave 1: PubChem identity + view (still the CID anchor for this app route)
  const [identityResult, viewResult] = await Promise.all([
    soft("pubchem-identity", getPubChemCompound(cid), {
      hit: null,
      traces: [
        {
          endpointUrl: `pubchem-identity:${cid}`,
          method: "GET",
          fetchedAt: new Date().toISOString(),
          ok: false,
          responseBody: "",
          error: "identity fetch soft-failed",
        },
      ],
    } as Awaited<ReturnType<typeof getPubChemCompound>>),
    soft("pubchem-view", fetchPubChemView(cid), {
      cid,
      blocks: [],
      hazards: {
        pictograms: [],
        hazardStatements: [],
        precautionaryStatements: [],
        rawBlocks: [],
      },
      manufacturingTexts: [],
      descriptionTexts: [],
      propertyTexts: [],
      traces: [],
    }),
  ]);

  identity = identityResult.hit;
  traces.push(...identityResult.traces);
  traces.push(...viewResult.traces);

  // Soft-fail: continue multi-API harvest even if PubChem identity is thin
  if (!identity) {
    identity = {
      cid,
      name: viewResult.title || `CID ${cid}`,
    };
    fetchErrors.push(
      "PubChem identity properties unavailable — continuing with CID-only identity."
    );
  }

  const name = identity?.name || viewResult.title || `CID ${cid}`;

  await politeDelay(40);

  // Wave 2: multi-source free public APIs (identity + process literature + patents)
  const waveResults = await mapSoftWave(
    [
      {
        label: "europepmc",
        run: () => searchEuropePmc(name, { limit: 14 }),
        fallback: { query: "", hits: [], traces: [] },
      },
      {
        label: "openalex",
        run: () => searchOpenAlexProcess(name, { limit: 6 }),
        fallback: { query: "", hits: [], traces: [] },
      },
      {
        label: "crossref",
        run: () => searchCrossrefProcess(name, { limit: 6 }),
        fallback: { query: "", hits: [], traces: [] },
      },
      {
        label: "semanticscholar",
        run: () => searchSemanticScholarProcess(name, { limit: 6 }),
        fallback: { query: "", hits: [], traces: [] },
      },
      {
        label: "pubmed",
        run: () => searchPubMedProcess(name, { limit: 10 }),
        fallback: { hits: [], traces: [], query: "" },
      },
      {
        label: "arxiv",
        run: () => searchArxivProcess(name, { limit: 6 }),
        fallback: { hits: [], traces: [], query: "", procedureTexts: [] },
      },
      {
        label: "patentsview",
        run: () => searchPatentsView(name, { limit: 10 }),
        fallback: {
          query: "",
          hits: [],
          traces: [],
          keyConfigured: false,
        },
      },
      {
        label: "patent-literature",
        run: () => searchPatentLiterature(name, { limit: 8 }),
        fallback: {
          query: "",
          hits: [],
          traces: [],
          keyConfigured: false,
        },
      },
      {
        label: "chembl",
        run: () => fetchChemblByName(name),
        fallback: {
          molecule: null,
          mechanisms: [],
          traces: [],
          query: "",
        },
      },
      {
        label: "mychem",
        run: () => fetchMyChemByName(name),
        fallback: { hit: null, traces: [], query: "" },
      },
      {
        label: "openfda",
        run: () => fetchOpenFdaByName(name),
        fallback: {
          hits: [],
          traces: [],
          query: "",
        } as Awaited<ReturnType<typeof fetchOpenFdaByName>>,
      },
      {
        label: "rxnorm",
        run: () => fetchRxNormByName(name),
        fallback: { hit: null, traces: [], query: "" },
      },
      {
        label: "kegg",
        run: () => fetchKeggByName(name),
        fallback: { hit: null, traces: [], query: "" },
      },
      {
        label: "comptox",
        run: () => fetchCompToxByName(name),
        fallback: {
          hit: null,
          traces: [],
          query: "",
        } as Awaited<ReturnType<typeof fetchCompToxByName>>,
      },
      {
        label: "dailymed",
        run: () => fetchDailyMedByName(name),
        fallback: {
          hits: [],
          traces: [],
          query: "",
        } as Awaited<ReturnType<typeof fetchDailyMedByName>>,
      },
      {
        label: "pubchem-patents",
        run: () => fetchPubchemPatentIds(cid, { limit: 40 }),
        fallback: { ids: [], traces: [] },
      },
      {
        label: "europepmc-pat",
        run: () => searchEuropePmcPatents(name, { limit: 8 }),
        fallback: { hits: [], traces: [], query: "" },
      },
      {
        label: "rhea",
        run: () => fetchRheaByName(name, { limit: 6 }),
        fallback: { hits: [], annotations: [], traces: [], query: "" },
      },
      {
        label: "unichem",
        run: () => fetchUnichemByPubchemCid(cid),
        fallback: { xrefs: [], annotations: [], traces: [] },
      },
      {
        label: "chebi",
        run: () => fetchChebiByName(name),
        fallback: {
          hit: null,
          annotations: [],
          traces: [],
          query: "",
        },
      },
      {
        label: "gsrs",
        run: () => fetchGsrsByName(name),
        fallback: {
          hit: null,
          annotations: [],
          traces: [],
          query: "",
        },
      },
      {
        label: "orgsyn",
        run: () => fetchOrgSynByName(name),
        fallback: {
          hits: [],
          annotations: [],
          procedureExcerpts: [],
          traces: [],
          query: "",
        },
      },
      {
        label: "reactome",
        run: () => fetchReactomeByName(name, { limit: 5 }),
        fallback: { hits: [], annotations: [], traces: [], query: "" },
      },
      {
        label: "wikipathways",
        run: () => fetchWikiPathwaysByName(name, { limit: 5 }),
        fallback: { hits: [], annotations: [], traces: [], query: "" },
      },
      {
        label: "pathway-commons",
        run: () => fetchPathwayCommonsByName(name, { limit: 5 }),
        fallback: { hits: [], annotations: [], traces: [], query: "" },
      },
      {
        label: "massbank",
        run: () => fetchMassBankByName(name),
        fallback: { hits: [], annotations: [], traces: [], query: "" },
      },
      {
        label: "drugcentral",
        run: () => fetchDrugCentralByName(name),
        fallback: {
          hit: null,
          annotations: [],
          traces: [],
          query: "",
        },
      },
      {
        label: "clinicaltrials",
        run: () => fetchClinicalTrialsByName(name, { limit: 5 }),
        fallback: { hits: [], annotations: [], traces: [], query: "" },
      },
      {
        label: "pubchem-class",
        run: () => fetchPubchemClassifications(cid),
        fallback: {
          annotations: [],
          texts: [],
          procedureExcerpts: [],
          traces: [],
        },
      },
    ],
    soft
  );

  const [
    litResult0,
    openAlexResult0,
    crossrefResult0,
    semanticResult,
    pubmedResult0,
    arxivResult,
    pvResult,
    patentLitResult,
    chemblResult0,
    mychemResult,
    openFdaResult0,
    rxnormResult,
    keggResult,
    comptoxResult,
    dailyMedResult,
    pubchemPatentIds,
    epmcPatResult0,
    rheaResult,
    unichemResult,
    chebiResult,
    gsrsResult,
    orgsynResult,
    reactomeResult,
    wikiPathResult,
    pcResult,
    massBankResult,
    drugCentralResult,
    ctResult,
    pubchemClassResult,
  ] = waveResults as [
    Awaited<ReturnType<typeof searchEuropePmc>>,
    Awaited<ReturnType<typeof searchOpenAlexProcess>>,
    Awaited<ReturnType<typeof searchCrossrefProcess>>,
    Awaited<ReturnType<typeof searchSemanticScholarProcess>>,
    Awaited<ReturnType<typeof searchPubMedProcess>>,
    Awaited<ReturnType<typeof searchArxivProcess>>,
    Awaited<ReturnType<typeof searchPatentsView>>,
    Awaited<ReturnType<typeof searchPatentLiterature>>,
    Awaited<ReturnType<typeof fetchChemblByName>>,
    Awaited<ReturnType<typeof fetchMyChemByName>>,
    Awaited<ReturnType<typeof fetchOpenFdaByName>>,
    Awaited<ReturnType<typeof fetchRxNormByName>>,
    Awaited<ReturnType<typeof fetchKeggByName>>,
    Awaited<ReturnType<typeof fetchCompToxByName>>,
    Awaited<ReturnType<typeof fetchDailyMedByName>>,
    Awaited<ReturnType<typeof fetchPubchemPatentIds>>,
    Awaited<ReturnType<typeof searchEuropePmcPatents>>,
    Awaited<ReturnType<typeof fetchRheaByName>>,
    Awaited<ReturnType<typeof fetchUnichemByPubchemCid>>,
    Awaited<ReturnType<typeof fetchChebiByName>>,
    Awaited<ReturnType<typeof fetchGsrsByName>>,
    Awaited<ReturnType<typeof fetchOrgSynByName>>,
    Awaited<ReturnType<typeof fetchReactomeByName>>,
    Awaited<ReturnType<typeof fetchWikiPathwaysByName>>,
    Awaited<ReturnType<typeof fetchPathwayCommonsByName>>,
    Awaited<ReturnType<typeof fetchMassBankByName>>,
    Awaited<ReturnType<typeof fetchDrugCentralByName>>,
    Awaited<ReturnType<typeof fetchClinicalTrialsByName>>,
    Awaited<ReturnType<typeof fetchPubchemClassifications>>,
  ];

  const etiquette = gatherEtiquetteSnapshot();
  fetchErrors.push(
    `gather-etiquette · concurrency ${etiquette.concurrency} · RL hosts ${etiquette.rateLimitedHosts.length} · circuits ${etiquette.circuitOpenHosts.length}`
  );

  // Mutable copies only for families the durable retry wave may reassign
  let litResult = litResult0;
  let openAlexResult = openAlexResult0;
  let crossrefResult = crossrefResult0;
  let pubmedResult = pubmedResult0;
  let chemblResult = chemblResult0;
  let openFdaResult = openFdaResult0;
  let epmcPatResult = epmcPatResult0;

  // Durable retry wave — only critical families that soft-failed / empty payload
  // Inter-wave delay scales with rate-limit pressure (API etiquette)
  await politeDelay(recommendedInterWaveDelayMs());
  if (
    sourceNeedsRetry(
      fetchErrors,
      "europepmc",
      litResult.hits.length > 0,
      litResult.traces
    )
  ) {
    litResult = await soft(
      "europepmc-retry",
      searchEuropePmc(name, { limit: 12 }),
      litResult
    );
  }
  if (
    sourceNeedsRetry(
      fetchErrors,
      "chembl",
      Boolean(chemblResult.molecule),
      chemblResult.traces
    )
  ) {
    chemblResult = await soft(
      "chembl-retry",
      fetchChemblByName(name),
      chemblResult
    );
  }
  if (
    sourceNeedsRetry(
      fetchErrors,
      "pubmed",
      pubmedResult.hits.length > 0,
      pubmedResult.traces
    )
  ) {
    pubmedResult = await soft(
      "pubmed-retry",
      searchPubMedProcess(name, { limit: 8 }),
      pubmedResult
    );
  }
  if (
    sourceNeedsRetry(
      fetchErrors,
      "crossref",
      crossrefResult.hits.length > 0,
      crossrefResult.traces
    )
  ) {
    crossrefResult = await soft(
      "crossref-retry",
      searchCrossrefProcess(name, { limit: 6 }),
      crossrefResult
    );
  }
  if (
    sourceNeedsRetry(
      fetchErrors,
      "openalex",
      openAlexResult.hits.length > 0,
      openAlexResult.traces
    )
  ) {
    openAlexResult = await soft(
      "openalex-retry",
      searchOpenAlexProcess(name, { limit: 6 }),
      openAlexResult
    );
  }
  if (
    sourceNeedsRetry(
      fetchErrors,
      "europepmc-pat",
      epmcPatResult.hits.length > 0,
      epmcPatResult.traces
    )
  ) {
    epmcPatResult = await soft(
      "europepmc-pat-retry",
      searchEuropePmcPatents(name, { limit: 8 }),
      epmcPatResult
    );
  }
  if (
    sourceNeedsRetry(
      fetchErrors,
      "openfda",
      openFdaResult.hits.length > 0,
      openFdaResult.traces
    )
  ) {
    openFdaResult = await soft(
      "openfda-retry",
      fetchOpenFdaByName(name),
      openFdaResult
    );
  }
  if (
    sourceNeedsRetry(
      fetchErrors,
      "pubchem-view",
      (viewResult.manufacturingTexts?.length || 0) > 0 ||
        (viewResult.hazards?.hazardStatements?.length || 0) > 0,
      viewResult.traces
    )
  ) {
    const retriedView = await soft(
      "pubchem-view-retry",
      fetchPubChemView(cid),
      viewResult
    );
    // Prefer denser manufacturing / hazard text; keep retry HTTP traces
    if (
      (retriedView.manufacturingTexts?.length || 0) >
        (viewResult.manufacturingTexts?.length || 0) ||
      (retriedView.hazards?.hazardStatements?.length || 0) >
        (viewResult.hazards?.hazardStatements?.length || 0) ||
      (retriedView.traces?.length || 0) > (viewResult.traces?.length || 0)
    ) {
      Object.assign(viewResult, retriedView);
      traces.push(...(retriedView.traces || []));
    }
  }

  traces.push(...litResult.traces);
  traces.push(...openAlexResult.traces);
  traces.push(...crossrefResult.traces);
  traces.push(...semanticResult.traces);
  traces.push(...pubmedResult.traces);
  traces.push(...arxivResult.traces);
  traces.push(...pvResult.traces);
  traces.push(...patentLitResult.traces);
  traces.push(...chemblResult.traces);
  traces.push(...mychemResult.traces);
  traces.push(...openFdaResult.traces);
  traces.push(...rxnormResult.traces);
  traces.push(...keggResult.traces);
  traces.push(...comptoxResult.traces);
  traces.push(...dailyMedResult.traces);
  traces.push(...pubchemPatentIds.traces);
  traces.push(...epmcPatResult.traces);
  traces.push(...rheaResult.traces);
  traces.push(...unichemResult.traces);
  traces.push(...chebiResult.traces);
  traces.push(...gsrsResult.traces);
  traces.push(...orgsynResult.traces);
  traces.push(...reactomeResult.traces);
  traces.push(...wikiPathResult.traces);
  traces.push(...pcResult.traces);
  traces.push(...massBankResult.traces);
  traces.push(...drugCentralResult.traces);
  traces.push(...ctResult.traces);
  traces.push(...pubchemClassResult.traces);

  // OA full-text densification (Europe PMC) for top process hits
  let literature = mergeLiterature([
    litResult.hits,
    openAlexResult.hits,
    crossrefResult.hits,
    semanticResult.hits,
    pubmedResult.hits,
    arxivResult.hits,
  ]).slice(0, 36);
  const oaEnrich = await soft(
    "europepmc-oa",
    enrichLiteratureWithOaFullText(literature, { maxArticles: 8 }),
    { hits: literature, traces: [] }
  );
  literature = oaEnrich.hits;
  traces.push(...oaEnrich.traces);

  const patentMap = new Map<string, (typeof pvResult.hits)[0]>();
  // Real patents only — do NOT merge patent-adjacent literature (epmc-patlit:MED:…)
  // into the patents bucket (pollutes densify + "28 patents" UI).
  // patentLitResult stays traced for soft-family health; process lit already covers papers.
  for (const p of pvResult.hits) {
    if (isStructuredPatentHit(p)) patentMap.set(p.id, p);
  }
  for (const p of epmcPatResult.hits) {
    if (isStructuredPatentHit(p) && !patentMap.has(p.id)) patentMap.set(p.id, p);
  }
  // PubChem patent xrefs (always free) fill IP coverage when PatentsView key is absent
  for (const p of patentHitsFromPubchemIds(pubchemPatentIds.ids, name)) {
    if (!isStructuredPatentHit(p)) continue;
    const key = p.patentNumber || p.id;
    if (![...patentMap.values()].some((x) => x.patentNumber === key || x.id === p.id)) {
      patentMap.set(p.id, p);
    }
  }
  let patents = filterStructuredPatents([...patentMap.values()]).slice(0, 28);
  const patentEnrich = await soft(
    "patent-epmc-densify",
    enrichPatentHitsWithEpmc(patents, { max: 8 }),
    { hits: patents, traces: [] }
  );
  patents = patentEnrich.hits;
  traces.push(...patentEnrich.traces);
  const usptoEnrich = await soft(
    "patent-uspto-densify",
    densifyUsPatentsWithPubchem(patents, { max: 6 }),
    { hits: patents, traces: [] }
  );
  patents = usptoEnrich.hits;
  traces.push(...usptoEnrich.traces);

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
        f.dosageAdmin?.slice(0, 160),
        f.howSupplied?.slice(0, 120),
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
        ...(f.dosageAdmin ? { dosageAdmin: f.dosageAdmin.slice(0, 200) } : {}),
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
        k.reactionEquations?.length
          ? `Equations: ${k.reactionEquations.slice(0, 2).join("; ")}`
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
        ...(k.reactionEquations?.length
          ? { equations: k.reactionEquations.slice(0, 3).join(" | ") }
          : {}),
      },
    });
    sourceRefs.push({
      type: "api",
      id: `kegg:${k.id}`,
      label: `KEGG ${k.id}`,
      url: k.url,
      note: "KEGG free REST compound / reaction equations",
    });
  }

  // Rhea enzyme reactions (biocatalytic context)
  annotations.push(...rheaResult.annotations);
  if (rheaResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `rhea:${cid}`,
      label: "Rhea enzyme reactions",
      url: `https://www.rhea-db.org/rhea?query=${encodeURIComponent(name)}`,
      note: `${rheaResult.hits.length} curated reaction hit(s)`,
    });
  }

  // Identity graph: UniChem / ChEBI / GSRS
  annotations.push(...unichemResult.annotations);
  if (unichemResult.xrefs.length) {
    sourceRefs.push({
      type: "api",
      id: `unichem:${cid}`,
      label: "UniChem cross-IDs",
      url: `https://www.ebi.ac.uk/unichem/`,
      note: `${unichemResult.xrefs.length} mapped source(s)`,
    });
  }
  annotations.push(...chebiResult.annotations);
  if (chebiResult.hit) {
    sourceRefs.push({
      type: "api",
      id: `chebi:${chebiResult.hit.chebiId}`,
      label: chebiResult.hit.chebiId,
      url: chebiResult.hit.url,
      note: "ChEBI ontology identity",
    });
  }
  annotations.push(...gsrsResult.annotations);
  if (gsrsResult.hit) {
    sourceRefs.push({
      type: "api",
      id: `gsrs:${gsrsResult.hit.unii || gsrsResult.hit.uuid || cid}`,
      label: gsrsResult.hit.unii
        ? `GSRS UNII ${gsrsResult.hit.unii}`
        : "GSRS substance",
      url: gsrsResult.hit.url,
      note: "FDA substance registration",
    });
  }

  // Organic Syntheses classic preps
  annotations.push(...orgsynResult.annotations);
  if (orgsynResult.hits.length || orgsynResult.procedureExcerpts.length) {
    sourceRefs.push({
      type: "api",
      id: `orgsyn:${cid}`,
      label: "Organic Syntheses",
      url: orgsynResult.hits[0]?.url || `https://www.orgsyn.org/search.aspx?q=${encodeURIComponent(name)}`,
      note: orgsynResult.procedureExcerpts.length
        ? "Classic prep procedure excerpt"
        : "Classic prep search",
    });
  }

  if (pubmedResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `pubmed:${cid}`,
      label: "PubMed (E-utilities)",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      note: pubmedResult.query.slice(0, 140),
    });
  }
  if (arxivResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `arxiv:${cid}`,
      label: "arXiv process preprints",
      url: "https://arxiv.org/",
      note: arxivResult.query.slice(0, 140),
    });
  }

  // Pathway / analytical / clinical / drug-card enrichment
  annotations.push(...reactomeResult.annotations);
  annotations.push(...wikiPathResult.annotations);
  annotations.push(...pcResult.annotations);
  annotations.push(...massBankResult.annotations);
  annotations.push(...drugCentralResult.annotations);
  annotations.push(...ctResult.annotations);
  annotations.push(...pubchemClassResult.annotations);

  if (reactomeResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `reactome:${cid}`,
      label: "Reactome pathways",
      url: `https://reactome.org/content/query?q=${encodeURIComponent(name)}`,
      note: `${reactomeResult.hits.length} pathway/reaction hit(s)`,
    });
  }
  if (wikiPathResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `wikipathways:${cid}`,
      label: "WikiPathways",
      url: "https://www.wikipathways.org/",
      note: `${wikiPathResult.hits.length} pathway(s)`,
    });
  }
  if (pcResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `pathway-commons:${cid}`,
      label: "Pathway Commons",
      url: "https://www.pathwaycommons.org/",
      note: `${pcResult.hits.length} pathway hit(s)`,
    });
  }
  const spectraHits = massBankResult.hits.filter(isHarvestedMassBankRecord);
  if (spectraHits.length) {
    sourceRefs.push({
      type: "api",
      id: `massbank:${cid}`,
      label: "MassBank spectra",
      url: "https://massbank.eu/",
      note: `${spectraHits.length} MS record(s) · IPC helper`,
    });
  }
  if (drugCentralResult.hit || drugCentralResult.annotations.length) {
    sourceRefs.push({
      type: "api",
      id: `drugcentral:${cid}`,
      label: "DrugCentral",
      url: drugCentralResult.hit?.url || "https://drugcentral.org/",
      note: "Drug card identity",
    });
  }
  if (ctResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `clinicaltrials:${cid}`,
      label: "ClinicalTrials.gov",
      url: "https://clinicaltrials.gov/",
      note: `${ctResult.hits.length} study(ies) · clinical scale context`,
    });
  }
  if (pubchemClassResult.annotations.length) {
    sourceRefs.push({
      type: "api",
      id: `pubchem-class:${cid}`,
      label: "PubChem classification / MeSH",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Classification`,
      note: "Classification + MeSH + PubMed xrefs",
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

  // Literature / patents with free-public densify captures for provenance + AI
  sourceRefs.push(...literatureToCapturedSourceRefs(literature, 18));
  sourceRefs.push(...patentToCapturedSourceRefs(patents, 28));

  if (pubchemPatentIds.ids.length) {
    annotations.push({
      source: "PubChem Patents",
      organization: "NCBI (NIH)",
      kind: "other",
      title: `${pubchemPatentIds.ids.length} patent cross-references`,
      summary:
        "Free PubChem PatentID xrefs for this CID. Prefer US/EP/WO for English claims/examples; paste public experimental text via Local enrich for denser process facts.",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Patents`,
      endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
      fields: {
        sample: pubchemPatentIds.ids.slice(0, 8).join(", "),
      },
    });
    sourceRefs.push({
      type: "api",
      id: `pubchem-patents:${cid}`,
      label: "PubChem patent xrefs",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Patents`,
      note: `${pubchemPatentIds.ids.length} PatentID values`,
    });
  }

  // ORD — free reaction dataset browse + best-effort snippets
  const ord = await soft(
    "ord",
    fetchOrdContext({
      name,
      smiles: identity?.smiles,
      cid,
    }),
    {
      annotations: [],
      traces: [],
      browseUrl: `https://open-reaction-database.org/client/browse?component=${encodeURIComponent(name)}`,
      note: "ORD soft-fallback",
      reactions: [],
      procedureTexts: [],
    }
  );
  annotations.push(...ord.annotations);
  traces.push(...ord.traces);
  sourceRefs.push({
    type: "api",
    id: `ord:${cid}`,
    label: "Open Reaction Database",
    url: ord.browseUrl,
    note: ord.note,
  });

  // ── Procedure-bearing excerpts for process-fact / AI density ──
  const procedureExcerpts: ProcedureExcerpt[] = [];
  for (const h of literature) {
    if (h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) {
      procedureExcerpts.push({
        id: `oa:${h.id}`,
        source: "europepmc-oa",
        label: h.title.slice(0, 100),
        text: h.fullTextExcerpt,
        url: h.url,
        chars: h.fullTextExcerpt.length,
      });
    }
  }
  for (const p of patents) {
    const body = p.procedureExcerpt || p.abstract;
    if (body && body.length >= 80) {
      procedureExcerpts.push({
        id: `pat-proc:${p.id}`,
        source: "patent",
        label: [p.patentNumber, p.title].filter(Boolean).join(" — ").slice(0, 100),
        text: body,
        url: p.url,
        chars: body.length,
      });
    }
  }
  for (const t of ord.procedureTexts) {
    if (t.length >= 40) {
      procedureExcerpts.push({
        id: `ord-proc:${cid}:${procedureExcerpts.length}`,
        source: "ord",
        label: "ORD browse / bulk pointer",
        text: t,
        url: ord.browseUrl,
        chars: t.length,
      });
    }
  }
  // Organic Syntheses procedures
  procedureExcerpts.push(...orgsynResult.procedureExcerpts);
  // arXiv abstract windows
  for (const t of arxivResult.procedureTexts) {
    if (t.length >= 60) {
      procedureExcerpts.push({
        id: `arxiv-proc:${cid}:${procedureExcerpts.length}`,
        source: "arxiv",
        label: "arXiv process abstract window",
        text: t,
        url: "https://arxiv.org/",
        chars: t.length,
      });
    }
  }
  for (const h of arxivResult.hits) {
    if (h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) {
      procedureExcerpts.push({
        id: `arxiv-ft:${h.id}`,
        source: "arxiv",
        label: h.title.slice(0, 100),
        text: h.fullTextExcerpt,
        url: h.url,
        chars: h.fullTextExcerpt.length,
      });
    }
  }
  for (const h of pubmedResult.hits) {
    if (h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) {
      procedureExcerpts.push({
        id: `pubmed-ft:${h.id}`,
        source: "pubmed",
        label: h.title.slice(0, 100),
        text: h.fullTextExcerpt,
        url: h.url,
        chars: h.fullTextExcerpt.length,
      });
    }
  }
  // openFDA dosage / how-supplied / description as formulation densify
  for (const f of openFdaResult.hits) {
    for (const [kind, text] of [
      ["dosage", f.dosageAdmin],
      ["how-supplied", f.howSupplied],
      ["description", f.description],
      ["clinical-pharm", f.clinicalPharmacology],
    ] as const) {
      if (text && text.length >= 60) {
        procedureExcerpts.push({
          id: `openfda:${f.id}:${kind}`,
          source: "other",
          label: `openFDA ${kind} · ${f.brandName || f.genericName || name}`,
          text,
          url: f.url,
          chars: text.length,
        });
      }
    }
  }
  // PubChem classification text (use-class context)
  for (const t of pubchemClassResult.texts) {
    if (t.length >= 40) {
      procedureExcerpts.push({
        id: `pubchem-class:${cid}:${procedureExcerpts.length}`,
        source: "other",
        label: "PubChem classification headings",
        text: t,
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Classification`,
        chars: t.length,
      });
    }
  }
  procedureExcerpts.push(...pubchemClassResult.procedureExcerpts);
  for (const t of viewResult.manufacturingTexts.slice(0, 12)) {
    if (t.length >= 40) {
      procedureExcerpts.push({
        id: `mfg:${cid}:${procedureExcerpts.length}`,
        source: "pubchem-mfg",
        label: "PubChem manufacturing / use",
        text: t,
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Use-and-Manufacturing`,
        chars: t.length,
      });
    }
  }
  if (keggResult.hit?.reactionEquations?.length) {
    const text = keggResult.hit.reactionEquations.join("\n");
    procedureExcerpts.push({
      id: `kegg-rn:${keggResult.hit.id}`,
      source: "kegg-reaction",
      label: `KEGG reactions ${keggResult.hit.id}`,
      text,
      url: keggResult.hit.url,
      chars: text.length,
    });
  }
  for (const r of rheaResult.hits) {
    if (r.equation) {
      procedureExcerpts.push({
        id: `rhea:${r.rheaId}`,
        source: "rhea",
        label: r.rheaId,
        text: r.equation,
        url: r.url,
        chars: r.equation.length,
      });
    }
  }

  // Process-relevant annotations → procedure windows (AI density without invention)
  for (const p of annotationsToProcedureExcerpts(annotations, cid)) {
    if (procedureExcerpts.some((x) => x.id === p.id)) continue;
    const head = p.text.slice(0, 100);
    if (procedureExcerpts.some((x) => x.text.slice(0, 100) === head)) continue;
    procedureExcerpts.push(p);
  }

  // Literature source notes
  sourceRefs.push({
    type: "api",
    id: `europepmc:${cid}`,
    label: "Europe PMC (+ OA full text when available)",
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
  if (epmcPatResult.hits.length) {
    sourceRefs.push({
      type: "api",
      id: `europepmc-pat:${cid}`,
      label: "Europe PMC patents (SRC:PAT)",
      url: "https://europepmc.org/",
      note: epmcPatResult.query.slice(0, 140),
    });
  }

  const base: CompoundEvidence = {
    cid,
    identity,
    view: viewResult,
    literature,
    patents,
    annotations,
    procedureExcerpts: procedureExcerpts.slice(0, 56),
    literatureQuery: [
      litResult.query,
      openAlexResult.query,
      crossrefResult.query,
      semanticResult.query,
      pubmedResult.query,
      arxivResult.query,
    ]
      .filter(Boolean)
      .join(" || "),
    patentsQuery: [pvResult.query, patentLitResult.query, epmcPatResult.query]
      .filter(Boolean)
      .join(" || "),
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
