/**
 * Parallel free-public evidence gather for a PubChem CID.
 * PubChem + Europe PMC multi-query + OpenAlex + PatentsView / patent lit.
 */

import { getPubChemCompound, type PubChemHit } from "@/lib/api/pubchem";
import { fetchPubChemView } from "@/lib/api/pubchemView";
import { searchEuropePmc, type LiteratureHit } from "@/lib/api/europePmc";
import { searchOpenAlexProcess } from "@/lib/api/openAlex";
import {
  searchPatentsView,
  searchPatentLiterature,
} from "@/lib/api/patentsView";
import { politeDelay } from "@/lib/api/rateLimit";
import { slimTraces, type ApiFetchTrace } from "@/lib/api/trace";
import type { SourceRef } from "@/lib/types/process";
import type { CompoundEvidence } from "@/lib/dossier/types";
import { scoreCompoundEvidence } from "@/lib/dossier/evidenceScore";

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

export async function gatherCompoundEvidence(cid: number): Promise<CompoundEvidence> {
  const traces: ApiFetchTrace[] = [];
  const sourceRefs: SourceRef[] = [];
  const fetchErrors: string[] = [];

  let identity: PubChemHit | null = null;

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

  await politeDelay(50);

  // Wave 2: literature + patents in parallel
  const [litResult, openAlexResult, pvResult, patentLitResult] = await Promise.all([
    searchEuropePmc(name, { limit: 16 }),
    searchOpenAlexProcess(name, { limit: 8 }),
    searchPatentsView(name, { limit: 10 }),
    searchPatentLiterature(name, { limit: 8 }),
  ]);

  traces.push(...litResult.traces);
  traces.push(...openAlexResult.traces);
  traces.push(...pvResult.traces);
  traces.push(...patentLitResult.traces);

  const literature = mergeLiterature([
    litResult.hits,
    openAlexResult.hits,
  ]).slice(0, 20);

  const patentMap = new Map<string, (typeof pvResult.hits)[0]>();
  for (const p of pvResult.hits) patentMap.set(p.id, p);
  for (const p of patentLitResult.hits) {
    if (!patentMap.has(p.id)) patentMap.set(p.id, p);
  }
  const patents = [...patentMap.values()].slice(0, 14);

  sourceRefs.push({
    type: "api",
    id: `pubchem:${cid}`,
    label: "PubChem compound record",
    url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    note: "NIH/NCBI free public compound page",
  });

  for (const hit of literature.slice(0, 16)) {
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

  const evidence: CompoundEvidence = {
    cid,
    identity,
    view: viewResult,
    literature,
    patents,
    literatureQuery: [litResult.query, openAlexResult.query].filter(Boolean).join(" || "),
    patentsQuery: pvResult.query || patentLitResult.query,
    patentsNote: [pvResult.note, patentLitResult.note].filter(Boolean).join(" "),
    traces: slimTraces(traces),
    sourceRefs,
    fetchErrors,
  };

  // Attach score as side-effect free recompute later in pipeline
  void scoreCompoundEvidence(evidence);

  return evidence;
}
