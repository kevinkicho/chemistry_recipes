/**
 * Retry only free-API families that soft-failed or returned empty payload.
 * Polite sequential re-query — does not abort or re-run healthy hosts.
 */

import { searchEuropePmc } from "@/lib/api/europePmc";
import { searchOpenAlexProcess } from "@/lib/api/openAlex";
import { searchCrossrefProcess } from "@/lib/api/crossref";
import { searchPubMedProcess } from "@/lib/api/pubmed";
import { fetchChemblByName } from "@/lib/api/chembl";
import { fetchOpenFdaByName } from "@/lib/api/openFda";
import { searchEuropePmcPatents } from "@/lib/api/patentFullText";
import { fetchPubChemView } from "@/lib/api/pubchemView";
import { fetchMyChemByName } from "@/lib/api/mychem";
import { fetchRxNormByName } from "@/lib/api/rxnorm";
import { fetchCompToxByName } from "@/lib/api/comptox";
import { fetchDailyMedByName } from "@/lib/api/dailyMed";
import { politeDelay } from "@/lib/api/rateLimit";
import type { ApiFetchTrace } from "@/lib/api/trace";
import type { CompoundEvidence } from "@/lib/dossier/types";
import { extractProcessFacts } from "@/lib/dossier/processFacts";
import { createSoftRunner } from "@/lib/dossier/gatherResilience";
import { failedFamiliesFromErrors } from "@/lib/dossier/densifyDelta";
import { mergeLiteratureHits } from "@/lib/dossier/retryFailedFamiliesMerge";

export type RetryFamiliesResult = {
  evidence: CompoundEvidence;
  retried: string[];
  stillFailed: string[];
  detail: string;
};

/**
 * Re-query labeled families from fetchErrors. Merges denser results into evidence.
 */
export async function retryFailedFamilies(
  evidence: CompoundEvidence,
  opts?: { families?: string[]; name?: string }
): Promise<RetryFamiliesResult> {
  const name =
    opts?.name ||
    evidence.identity?.name ||
    `CID ${evidence.cid}`;
  const cid = evidence.cid;
  const traces: ApiFetchTrace[] = [...(evidence.traces || [])];
  const fetchErrors = [...(evidence.fetchErrors || [])];
  const soft = createSoftRunner({ fetchErrors, traces });

  const fromErrors = failedFamiliesFromErrors(fetchErrors).map((f) => f.label);
  const want = new Set(
    (opts?.families?.length ? opts.families : fromErrors).map((s) =>
      s.toLowerCase().replace(/-retry$/, "")
    )
  );

  if (!want.size) {
    return {
      evidence,
      retried: [],
      stillFailed: [],
      detail: "No soft-fail / api-fail families to retry",
    };
  }

  const retried: string[] = [];
  let literature = [...(evidence.literature || [])];
  let patents = [...(evidence.patents || [])];
  const annotations = [...(evidence.annotations || [])];
  let view = evidence.view;

  const run = async (label: string, fn: () => Promise<void>) => {
    if (!want.has(label) && !want.has(label.replace(/-retry$/, ""))) return;
    retried.push(label);
    await fn();
    await politeDelay(90);
  };

  await run("europepmc", async () => {
    const r = await soft(
      "europepmc-retry",
      searchEuropePmc(name, { limit: 12 }),
      { hits: [], traces: [], query: "" }
    );
    if (r.hits.length) literature = mergeLiteratureHits(literature, r.hits);
  });
  await run("openalex", async () => {
    const r = await soft(
      "openalex-retry",
      searchOpenAlexProcess(name, { limit: 6 }),
      { hits: [], traces: [], query: "" }
    );
    if (r.hits.length) literature = mergeLiteratureHits(literature, r.hits);
  });
  await run("crossref", async () => {
    const r = await soft(
      "crossref-retry",
      searchCrossrefProcess(name, { limit: 6 }),
      { hits: [], traces: [], query: "" }
    );
    if (r.hits.length) literature = mergeLiteratureHits(literature, r.hits);
  });
  await run("pubmed", async () => {
    const r = await soft(
      "pubmed-retry",
      searchPubMedProcess(name, { limit: 8 }),
      { hits: [], traces: [], query: "" }
    );
    if (r.hits.length) literature = mergeLiteratureHits(literature, r.hits);
  });
  await run("chembl", async () => {
    await soft("chembl-retry", fetchChemblByName(name), {
      molecule: null,
      mechanisms: [],
      traces: [],
      query: "",
    });
  });
  await run("openfda", async () => {
    await soft("openfda-retry", fetchOpenFdaByName(name), {
      hits: [],
      traces: [],
      query: "",
    });
  });
  await run("europepmc-pat", async () => {
    const r = await soft(
      "europepmc-pat-retry",
      searchEuropePmcPatents(name, { limit: 8 }),
      { hits: [], traces: [], query: "" }
    );
    if (r.hits.length) {
      const map = new Map(patents.map((p) => [p.id, p]));
      for (const p of r.hits) if (!map.has(p.id)) map.set(p.id, p);
      patents = [...map.values()];
    }
  });
  await run("pubchem-view", async () => {
    if (!view) return;
    const r = await soft("pubchem-view-retry", fetchPubChemView(cid), view);
    if (
      (r.manufacturingTexts?.length || 0) >
        (view.manufacturingTexts?.length || 0) ||
      (r.hazards?.hazardStatements?.length || 0) >
        (view.hazards?.hazardStatements?.length || 0)
    ) {
      view = r;
    }
  });
  await run("mychem", async () => {
    await soft("mychem-retry", fetchMyChemByName(name), {
      hit: null,
      traces: [],
      query: "",
    });
  });
  await run("rxnorm", async () => {
    await soft("rxnorm-retry", fetchRxNormByName(name), {
      hit: null,
      traces: [],
      query: "",
    });
  });
  await run("comptox", async () => {
    await soft("comptox-retry", fetchCompToxByName(name), {
      hit: null,
      traces: [],
      query: "",
    });
  });
  await run("dailymed", async () => {
    await soft("dailymed-retry", fetchDailyMedByName(name), {
      hits: [],
      traces: [],
      query: "",
    });
  });

  const next: CompoundEvidence = {
    ...evidence,
    literature,
    patents,
    annotations,
    view: view || evidence.view,
    traces,
    fetchErrors: [
      ...fetchErrors,
      `retry-families · attempted ${retried.join(", ") || "none"}`,
    ].slice(0, 80),
  };
  next.processFacts = extractProcessFacts(next);

  const still = failedFamiliesFromErrors(next.fetchErrors)
    .map((f) => f.label)
    .filter((l) => retried.some((r) => r.startsWith(l) || l.startsWith(r)));

  return {
    evidence: next,
    retried,
    stillFailed: still,
    detail: `Retried ${retried.length} family(ies): ${retried.join(", ") || "—"}`,
  };
}
