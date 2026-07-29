/**
 * Second densify pass — when first gather left procedure text thin,
 * re-run OA full text + patent densify with higher limits and soft timeouts.
 *
 * Goal: break free-API ceiling via durable multi-pass harvest, not invented data.
 */

import { enrichLiteratureWithOaFullText } from "@/lib/api/europePmc";
import { enrichPatentHitsWithEpmc } from "@/lib/api/patentFullText";
import { densifyUsPatentsWithPubchem } from "@/lib/api/usptoFullText";
import { fetchOrgSynByName } from "@/lib/api/orgsyn";
import { fetchEuropePmcFullTextXml } from "@/lib/api/europePmc";
import { politeDelay } from "@/lib/api/rateLimit";
import type { CompoundEvidence, ProcedureExcerpt } from "@/lib/dossier/types";
import { extractProcessFacts } from "@/lib/dossier/processFacts";
import {
  countProcedureChars,
  withSoftTimeout,
} from "@/lib/dossier/gatherResilience";

/** Thresholds: below these, attempt densify pass */
export const DENSIFY_MIN_PROCEDURE_CHARS = 1800;
export const DENSIFY_MIN_EXCERPTS = 4;

export function needsDensifyPass(evidence: CompoundEvidence): boolean {
  const chars = countProcedureChars({
    procedureExcerpts: evidence.procedureExcerpts,
    literature: evidence.literature,
    patents: evidence.patents,
    manufacturingTexts: evidence.view?.manufacturingTexts,
  });
  const excerpts = evidence.procedureExcerpts?.length || 0;
  return chars < DENSIFY_MIN_PROCEDURE_CHARS || excerpts < DENSIFY_MIN_EXCERPTS;
}

/**
 * Expand procedureExcerpts from literature/patent densification.
 */
export async function runDensifyPass(
  evidence: CompoundEvidence
): Promise<CompoundEvidence> {
  if (!needsDensifyPass(evidence)) return evidence;

  const name = evidence.identity?.name || `CID ${evidence.cid}`;
  const traces = [...(evidence.traces || [])];
  const fetchErrors = [...(evidence.fetchErrors || [])];
  let literature = [...(evidence.literature || [])];
  let patents = [...(evidence.patents || [])];
  const procedureExcerpts: ProcedureExcerpt[] = [
    ...(evidence.procedureExcerpts || []),
  ];
  const seenExcerpt = new Set(procedureExcerpts.map((p) => p.id));

  const pushExcerpt = (p: ProcedureExcerpt) => {
    if (!p.text || p.text.length < 60) return;
    if (seenExcerpt.has(p.id)) {
      // Upgrade text if longer
      const i = procedureExcerpts.findIndex((x) => x.id === p.id);
      if (i >= 0 && p.text.length > procedureExcerpts[i]!.text.length) {
        procedureExcerpts[i] = p;
      }
      return;
    }
    seenExcerpt.add(p.id);
    procedureExcerpts.push(p);
  };

  // Rank literature by process/procedure density before OA budget spend
  const processScore = (title: string, body?: string) => {
    const t = `${title} ${body || ""}`;
    let s = 0;
    if (/synthes|manufactur|process|ferment|preparat|industrial|scale|crystal|hydrogen|workup|equiv|°\s*C/i.test(t))
      s += 4;
    if (/example\s+\d+|procedure|method of making/i.test(t)) s += 3;
    if ((body?.length || 0) > 400) s += 2;
    if (/\b\d+\s*°\s*C\b/.test(t)) s += 2;
    return s;
  };
  literature = [...literature].sort((a, b) => {
    const sa =
      processScore(a.title, a.fullTextExcerpt || a.abstract) +
      (a.fullTextExcerpt ? 3 : 0) +
      (a.pmcid ? 2 : 0);
    const sb =
      processScore(b.title, b.fullTextExcerpt || b.abstract) +
      (b.fullTextExcerpt ? 3 : 0) +
      (b.pmcid ? 2 : 0);
    return sb - sa;
  });

  // 1) OA full text — process-ranked, higher article budget
  try {
    const oa = await withSoftTimeout(
      enrichLiteratureWithOaFullText(literature, { maxArticles: 10 }),
      50_000,
      { hits: literature, traces: [] }
    );
    literature = oa.hits;
    traces.push(...oa.traces);
    for (const h of literature) {
      if (h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) {
        pushExcerpt({
          id: `oa-d2:${h.id}`,
          source: "europepmc-oa",
          label: h.title.slice(0, 100),
          text: h.fullTextExcerpt,
          url: h.url,
          chars: h.fullTextExcerpt.length,
        });
      }
    }
  } catch (e) {
    fetchErrors.push(
      `densify OA: ${e instanceof Error ? e.message : "failed"}`
    );
  }

  // 2) Extra PMC full text for process-ranked OA with pmcid not yet densified
  const extraPmc = literature
    .filter((h) => h.pmcid && !(h.fullTextExcerpt && h.fullTextExcerpt.length > 200))
    .slice(0, 5);
  for (const h of extraPmc) {
    try {
      const ft = await withSoftTimeout(
        fetchEuropePmcFullTextXml(h.pmcid!),
        14_000,
        null
      );
      if (ft?.excerpt && ft.excerpt.length >= 80) {
        h.fullTextExcerpt = ft.excerpt;
        h.fullTextChars = ft.plain.length;
        traces.push(ft.trace);
        pushExcerpt({
          id: `oa-d2x:${h.id}`,
          source: "europepmc-oa",
          label: h.title.slice(0, 100),
          text: ft.excerpt,
          url: h.url,
          chars: ft.excerpt.length,
        });
      }
      await politeDelay(100);
    } catch {
      /* continue */
    }
  }

  // 3) Patent densify
  try {
    const pe = await withSoftTimeout(
      enrichPatentHitsWithEpmc(patents, { max: 8 }),
      40_000,
      { hits: patents, traces: [] }
    );
    patents = pe.hits;
    traces.push(...pe.traces);
    const us = await withSoftTimeout(
      densifyUsPatentsWithPubchem(patents, { max: 6 }),
      30_000,
      { hits: patents, traces: [] }
    );
    patents = us.hits;
    traces.push(...us.traces);
    for (const p of patents) {
      const body = p.procedureExcerpt || p.abstract;
      if (body && body.length >= 80) {
        pushExcerpt({
          id: `pat-d2:${p.id}`,
          source: "patent",
          label: [p.patentNumber, p.title].filter(Boolean).join(" — ").slice(0, 100),
          text: body,
          url: p.url,
          chars: body.length,
        });
      }
    }
  } catch (e) {
    fetchErrors.push(
      `densify patents: ${e instanceof Error ? e.message : "failed"}`
    );
  }

  // 4) OrgSyn retry if no orgsyn excerpt yet
  if (!procedureExcerpts.some((p) => p.source === "orgsyn")) {
    try {
      const os = await withSoftTimeout(
        fetchOrgSynByName(name),
        20_000,
        null
      );
      if (os) {
        traces.push(...os.traces);
        for (const p of os.procedureExcerpts) pushExcerpt(p);
      }
    } catch (e) {
      fetchErrors.push(
        `densify orgsyn: ${e instanceof Error ? e.message : "failed"}`
      );
    }
  }

  // 5) Promote process-dense abstracts still lacking full-text as secondary windows
  for (const h of literature) {
    if (h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) continue;
    const body = h.abstract || "";
    if (body.length < 200) continue;
    if (processScore(h.title, body) < 5) continue;
    pushExcerpt({
      id: `abs-d2:${h.id}`,
      source: h.pmid ? "pubmed" : h.pmcid ? "europepmc-oa" : "other",
      label: `Abstract · ${h.title.slice(0, 80)}`,
      text: body,
      url: h.url,
      chars: body.length,
    });
  }

  // Prefer densest procedure windows first in the package
  procedureExcerpts.sort(
    (a, b) => (b.chars || b.text.length) - (a.chars || a.text.length)
  );

  const densified: CompoundEvidence = {
    ...evidence,
    literature,
    patents,
    procedureExcerpts: procedureExcerpts.slice(0, 64),
    traces,
    fetchErrors: [
      ...fetchErrors,
      `densify-pass: procedure chars ~${countProcedureChars({
        procedureExcerpts,
        literature,
        patents,
        manufacturingTexts: evidence.view?.manufacturingTexts,
      })} · excerpts ${procedureExcerpts.length}`,
    ].slice(0, 50),
  };

  densified.processFacts = extractProcessFacts(densified);
  return densified;
}
