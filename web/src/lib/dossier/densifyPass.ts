/**
 * Second densify pass — when first gather left procedure text thin,
 * re-run OA full text + patent densify with higher limits and soft timeouts.
 *
 * Goal: break free-API ceiling via durable multi-pass harvest, not invented data.
 */

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
import {
  deepDensifyLiterature,
  literatureToCapturedSourceRefs,
  patentToCapturedSourceRefs,
} from "@/lib/dossier/deepDensify";
import {
  planLiteratureDensifyTargets,
  planPatentDensifyTargets,
  rankProcedureTextsForPack,
} from "@/lib/dossier/densifyBudgetPlanner";
import { promoteAnnotationsToProcedureExcerpts } from "@/lib/dossier/annotationExcerpts";

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
  if (chars < DENSIFY_MIN_PROCEDURE_CHARS || excerpts < DENSIFY_MIN_EXCERPTS) {
    return true;
  }
  // Still densify when many lit hits lack abstracts/excerpts (missed free-API body)
  const lit = evidence.literature || [];
  if (lit.length >= 3) {
    const thin = lit.filter(
      (h) => !(h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) && !(h.abstract && h.abstract.length >= 120)
    ).length;
    if (thin >= Math.ceil(lit.length * 0.5)) return true;
  }
  const softs = (evidence.fetchErrors || []).filter(
    (e) => e.startsWith("soft-fail ·") || e.startsWith("api-fail ·")
  ).length;
  return softs >= 4;
}

/**
 * Expand procedureExcerpts from literature/patent densification.
 */
export async function runDensifyPass(
  evidence: CompoundEvidence,
  opts?: { force?: boolean }
): Promise<CompoundEvidence> {
  if (!opts?.force && !needsDensifyPass(evidence)) return evidence;

  const name = evidence.identity?.name || `CID ${evidence.cid}`;
  const traces = [...(evidence.traces || [])];
  const fetchErrors = [...(evidence.fetchErrors || [])];
  let literature = [...(evidence.literature || [])];
  let patents = [...(evidence.patents || [])];
  const procedureExcerpts: ProcedureExcerpt[] = [
    ...(evidence.procedureExcerpts || []),
  ];
  const seenExcerpt = new Set(procedureExcerpts.map((p) => p.id));
  /** Per-step durability: never throw out of densify steps */
  async function step<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await run();
    } catch (e) {
      fetchErrors.push(
        `densify-step · ${label}: ${e instanceof Error ? e.message : "failed"}`.slice(
          0,
          220
        )
      );
      traces.push({
        endpointUrl: `densify-fail://${label}`,
        method: "SOFT",
        fetchedAt: new Date().toISOString(),
        ok: false,
        responseBody: "",
        error: e instanceof Error ? e.message : String(e),
      });
      return fallback;
    }
  }

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

  // Budget planner: thin high-score literature first for densify spend
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
  {
    const planned = planLiteratureDensifyTargets(literature, {
      max: literature.length,
      minScore: 6,
    });
    const planIds = new Set(planned.map((h) => h.id));
    literature = [
      ...planned,
      ...literature.filter((h) => !planIds.has(h.id)),
    ];
  }

  // Promote process-relevant annotations → procedure windows before densify ranking
  {
    const promoted = promoteAnnotationsToProcedureExcerpts({
      ...evidence,
      literature,
      patents,
      procedureExcerpts,
    });
    for (const p of promoted.procedureExcerpts || []) pushExcerpt(p);
  }

  // 1) Deep densify — metadata (EPMC/Crossref) + OA full text, planner-ranked
  {
    const deep = await step(
      "deep-literature",
      () =>
        withSoftTimeout(
          deepDensifyLiterature(literature, { maxMeta: 16, maxOa: 12 }),
          70_000,
          { hits: literature, traces: [] }
        ),
      { hits: literature, traces: [] }
    );
    literature = deep.hits;
    traces.push(...deep.traces);
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
      } else if (h.abstract && h.abstract.length >= 200) {
        pushExcerpt({
          id: `abs-d2:${h.id}`,
          source: h.pmid ? "pubmed" : "other",
          label: `Abstract · ${h.title.slice(0, 80)}`,
          text: h.abstract,
          url: h.url,
          chars: h.abstract.length,
        });
      }
    }
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

  // 3) Patent densify — boost budget when OA literature is sparse
  const oaWindows = literature.filter(
    (h) => (h.fullTextExcerpt?.length || 0) >= 80
  ).length;
  const oaSparse = oaWindows < 2;
  // Planner: thin/high-score patents first for densify budget
  {
    const plannedP = planPatentDensifyTargets(patents, {
      max: patents.length || 12,
    });
    const planIds = new Set(plannedP.map((p) => p.id));
    patents = [
      ...plannedP,
      ...patents.filter((p) => !planIds.has(p.id)),
    ];
  }
  const epmcPatMax = oaSparse ? 12 : 8;
  const usPatMax = oaSparse ? 10 : 6;
  try {
    const pe = await withSoftTimeout(
      enrichPatentHitsWithEpmc(patents, { max: epmcPatMax }),
      oaSparse ? 50_000 : 40_000,
      { hits: patents, traces: [] }
    );
    patents = pe.hits;
    traces.push(...pe.traces);
    const us = await withSoftTimeout(
      densifyUsPatentsWithPubchem(patents, { max: usPatMax }),
      oaSparse ? 40_000 : 30_000,
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
    if (oaSparse) {
      fetchErrors.push(
        `densify patents: OA-sparse boost · epmc max ${epmcPatMax} · US max ${usPatMax} · oaWindows ${oaWindows}`
      );
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

  // Prefer highest procedure-window score (then length) for AI pack order
  {
    const ranked = rankProcedureTextsForPack(
      procedureExcerpts.map((p) => ({
        id: p.id,
        text: p.text,
        label: p.label,
        chars: p.chars || p.text.length,
      }))
    );
    const byId = new Map(procedureExcerpts.map((p) => [p.id, p]));
    procedureExcerpts.length = 0;
    for (const r of ranked) {
      const p = byId.get(r.id);
      if (p) procedureExcerpts.push(p);
    }
  }

  // Refresh lit/patent sourceRefs with densify captures for provenance
  const nonLitPat = (evidence.sourceRefs || []).filter(
    (r) => r.type !== "literature" && r.type !== "patent"
  );
  const sourceRefs = [
    ...nonLitPat,
    ...literatureToCapturedSourceRefs(literature, 18),
    ...patentToCapturedSourceRefs(patents, 28),
  ];

  const densified: CompoundEvidence = {
    ...evidence,
    literature,
    patents,
    procedureExcerpts: procedureExcerpts.slice(0, 64),
    sourceRefs,
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
