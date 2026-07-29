/**
 * AI guidance package — compact, densify-first evidence for agents.
 * Goal: maximize useful free-public process data for suggestion/guide,
 * not UI full-text previews. Every claim stays quote-bound.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import { scoreProcedureWindow } from "@/lib/literature/procedureWindowScore";
import { buildLiteratureDepthReport } from "@/lib/frontier/literatureDepth";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import { packageIsUsable } from "@/lib/frontier/knowledgeFingerprint";

export const AI_GUIDANCE_SCHEMA =
  "chemistry-recipes.ai-guidance.v1" as const;

export type DensifyActionKind =
  | "oa-literature"
  | "patent-procedure"
  | "local-paste"
  | "neighbor-impurity"
  | "multi-source-search"
  | "force-regather"
  | "campaign-densify";

export interface DensifyNextAction {
  id: string;
  kind: DensifyActionKind;
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  /** What the app can do / user can trigger */
  how: string;
  /** Expected densify signal */
  expectedGain: string;
}

export interface AiGuidancePackage {
  schema: typeof AI_GUIDANCE_SCHEMA;
  cid: number;
  moleculeName?: string;
  generatedAt: string;
  disclaimer: string;
  /** 0–100 densify readiness for AI structure (not GMP) */
  ingestScore: number;
  summary: string;
  /** Ranked procedure windows for model context */
  procedureWindows: Array<{
    id: string;
    source: string;
    label: string;
    score: number;
    chars: number;
    text: string;
    url?: string;
  }>;
  /** Grounded process claims */
  processAtoms: Array<{
    kind: string;
    claim: string;
    value?: string;
    unit?: string;
    quote?: string;
    sourceLabel: string;
    unitOp?: string;
  }>;
  conditionSummaries: string[];
  openGaps: string[];
  multiSourceHints: string[];
  densifyNext: DensifyNextAction[];
  metrics: {
    procedureChars: number;
    procedureWindows: number;
    processFactConditions: number;
    atlasObs: number;
    literatureDepthScore: number;
    annotationCount: number;
    patentWindows: number;
    oaLitWindows: number;
    harvestedExcerpts: number;
  };
}

const DISCLAIMER =
  "AI guidance package from free-public densify only. Structure and prioritize evidence — " +
  "never invent plant limits, CPPs, or site setpoints. Not GMP.";

function ingestScoreOf(m: AiGuidancePackage["metrics"]): number {
  return Math.min(
    100,
    Math.round(
      Math.min(30, m.procedureChars / 140) +
        Math.min(18, m.processFactConditions * 4) +
        Math.min(12, m.atlasObs * 2) +
        Math.min(14, m.literatureDepthScore * 0.14) +
        Math.min(12, m.oaLitWindows * 2 + m.patentWindows) +
        Math.min(8, m.harvestedExcerpts) +
        Math.min(6, Math.min(m.annotationCount, 12) * 0.5)
    )
  );
}

/**
 * Build densify-first package for science agents / Ollama structure prompts.
 */
export function buildAiGuidancePackage(dossier: LiveDossier): AiGuidancePackage {
  const pack =
    dossier.processKnowledge || buildProcessKnowledgePackage(dossier);
  const litDepth = buildLiteratureDepthReport(dossier);

  const windows: AiGuidancePackage["procedureWindows"] = [];
  const seenIds = new Set<string>();

  const pushWin = (w: AiGuidancePackage["procedureWindows"][0]) => {
    if (!w.text || w.text.length < 40) return;
    if (seenIds.has(w.id)) return;
    seenIds.add(w.id);
    windows.push(w);
  };

  // 1) Durable densify harvest first (OA / patent / OrgSyn / ORD / …)
  for (const pe of dossier.procedureExcerpts || []) {
    const text = pe.text || "";
    if (text.length < 40) continue;
    pushWin({
      id: pe.id,
      source: pe.source,
      label: pe.label.slice(0, 80),
      score: scoreProcedureWindow(`${pe.label}\n${text}`),
      chars: pe.chars || text.length,
      text: text.slice(0, 2400),
      url: pe.url,
    });
  }

  // 2) Literature depth top windows (resolve text from dossier fields)
  for (const w of litDepth.topWindows) {
    let text = "";
    let url: string | undefined;
    let id = `${w.kind}:${w.label.slice(0, 40)}`;
    if (w.sourceField?.startsWith("procedureExcerpts:")) {
      // already covered from procedureExcerpts above
      continue;
    }
    if (w.kind === "literature") {
      const h = (dossier.literature || []).find(
        (x) =>
          x.title?.slice(0, 80) === w.label ||
          (x.fullTextExcerpt?.length || 0) === w.chars
      );
      text = h?.fullTextExcerpt || h?.abstract || "";
      url = h?.url;
      id = h?.id || id;
    } else if (w.kind === "patent") {
      const h = (dossier.patents || []).find(
        (x) =>
          (x.patentNumber || x.title)?.slice(0, 80) === w.label ||
          (x.procedureExcerpt?.length || 0) === w.chars
      );
      text = h?.procedureExcerpt || h?.abstract || "";
      url = h?.url;
      id = h?.id || id;
    } else if (w.kind === "mfg") {
      text = (dossier.manufacturingTexts || [])[0] || "";
      id = `mfg:${dossier.cid}`;
    }
    if (text.length < 40) continue;
    pushWin({
      id,
      source: w.kind,
      label: w.label,
      score: w.score,
      chars: text.length,
      text: text.slice(0, 2400),
      url,
    });
  }

  // 3) Fill from raw lit/patents if still thin
  if (windows.length < 8) {
    for (const h of dossier.literature || []) {
      const text = h.fullTextExcerpt || h.abstract || "";
      if (text.length < 80) continue;
      const score = scoreProcedureWindow(`${h.title}\n${text}`);
      if (score < 4) continue;
      pushWin({
        id: h.id,
        source: "literature",
        label: h.title.slice(0, 80),
        score,
        chars: text.length,
        text: text.slice(0, 2400),
        url: h.url,
      });
    }
    for (const p of dossier.patents || []) {
      const text = p.procedureExcerpt || p.abstract || "";
      if (text.length < 80) continue;
      const score = scoreProcedureWindow(`${p.title}\n${text}`);
      if (score < 4) continue;
      pushWin({
        id: p.id,
        source: "patent",
        label: (p.patentNumber || p.title).slice(0, 80),
        score,
        chars: text.length,
        text: text.slice(0, 2400),
        url: p.url,
      });
    }
  }

  windows.sort((a, b) => b.score - a.score || b.chars - a.chars);

  const processAtoms = (dossier.processFacts?.facts || [])
    .filter((f) => f.kind !== "open-gap")
    .slice(0, 48)
    .map((f) => ({
      kind: f.kind,
      claim: f.claim,
      value: f.value,
      unit: f.unit,
      quote: f.quote?.slice(0, 220),
      sourceLabel: f.sourceLabel,
      unitOp: f.unitOp,
    }));

  const conditionSummaries = pack.conditionAtlas.distributions
    .slice(0, 12)
    .map((d) => d.summary);

  const openGaps = [
    ...(dossier.processFacts?.openGaps || []),
    ...(dossier.idealParity?.sections || [])
      .filter((s) => s.depth < 40)
      .map((s) => `Ideal thin: ${s.label} (${s.depth}/100) — ${s.howToClose || s.detail}`),
  ].slice(0, 12);

  const multiSourceHints = (dossier.annotations || [])
    .slice(0, 16)
    .map(
      (a) =>
        `${a.source}${a.kind ? `/${a.kind}` : ""}: ${(a.title || "").slice(0, 60)}${
          a.summary ? ` — ${a.summary.slice(0, 120)}` : ""
        }`
    );

  const harvestedExcerpts = (dossier.procedureExcerpts || []).length;
  const oaLitWindows = (dossier.literature || []).filter(
    (h) => (h.fullTextExcerpt?.length || 0) >= 80
  ).length;
  const patentWindows = (dossier.patents || []).filter(
    (h) => (h.procedureExcerpt?.length || 0) >= 80
  ).length;
  const procedureChars =
    pack.metrics.procedureChars ||
    windows.reduce((n, w) => n + w.chars, 0);

  const metrics: AiGuidancePackage["metrics"] = {
    procedureChars,
    procedureWindows: windows.length,
    processFactConditions:
      dossier.processFacts?.sourcedConditionCount ??
      pack.metrics.processFactConditions,
    atlasObs: pack.metrics.observationCount,
    literatureDepthScore: litDepth.depthScore,
    annotationCount: (dossier.annotations || []).length,
    patentWindows,
    oaLitWindows,
    harvestedExcerpts,
  };

  const densifyNext: DensifyNextAction[] = [];
  if (oaLitWindows < 2 && harvestedExcerpts < 4) {
    densifyNext.push({
      id: "act:oa",
      kind: "oa-literature",
      priority: "high",
      title: "Densify OA procedure literature",
      rationale: `Only ${oaLitWindows} OA lit window(s) · ${harvestedExcerpts} harvested excerpt(s) — AI lacks experimental narrative`,
      how: "Refresh densify / force re-gather, or paste process papers with PMCID for OA full-text",
      expectedGain: "More procedure windows + condition quotes for structure",
    });
  }
  if (patentWindows < 2) {
    densifyNext.push({
      id: "act:pat",
      kind: "patent-procedure",
      priority: "high",
      title: "Densify patent example windows",
      rationale: `Only ${patentWindows} patent procedure window(s)`,
      how: "Patents table → paste process patents, or force densify pass",
      expectedGain: "Example-level T/t/equiv language for process facts",
    });
  }
  if ((metrics.processFactConditions || 0) < 3) {
    densifyNext.push({
      id: "act:paste",
      kind: "local-paste",
      priority: "high",
      title: "Add public procedure paste",
      rationale: "Few sourced condition atoms — structure is thin for AI guidance",
      how: "Local paste wizard or lit/patent densify paste on process-tagged rows",
      expectedGain: "Sourced processFacts.atoms for plant-readable claims",
    });
  }
  if (!packageIsUsable(pack) || metrics.atlasObs < 2) {
    densifyNext.push({
      id: "act:force",
      kind: "force-regather",
      priority: "medium",
      title: "Force free-public re-gather",
      rationale: "Process-knowledge package thin or unusable",
      how: "Refresh with force densify / skip warm cache",
      expectedGain: "Fresh multi-API harvest into atlas + network",
    });
  }
  const impurityCids = (dossier.relatedEntities || []).filter(
    (e) => e.role === "impurity" && e.pubchemCid
  ).length;
  if (impurityCids > 0 && !(pack.reactionNetwork?.campaignCids.length || 0)) {
    densifyNext.push({
      id: "act:imp",
      kind: "neighbor-impurity",
      priority: "medium",
      title: "Densify impurity/related CIDs",
      rationale: `${impurityCids} impurity entity(ies) with PubChem CIDs not in densify network`,
      how: "Reaction network → densify impurities/related or impurity campaign",
      expectedGain: "Multi-CID edge evidence for science agent",
    });
  }
  if (metrics.annotationCount < 4) {
    densifyNext.push({
      id: "act:multi",
      kind: "multi-source-search",
      priority: "low",
      title: "Expand multi-source identity joins",
      rationale: "Few external annotations for identity/EHS context",
      how: "Force re-gather (ChEMBL/GSRS/openFDA/KEGG joins on server densify)",
      expectedGain: "Richer annotations for guidance context (not plant numbers)",
    });
  }
  densifyNext.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });

  const score = ingestScoreOf(metrics);
  const summary =
    `AI ingest ${score}/100 · ${metrics.procedureChars.toLocaleString()} proc chars · ` +
    `${metrics.harvestedExcerpts} excerpts · ${metrics.processFactConditions} conditions · ` +
    `atlas ${metrics.atlasObs} · lit depth ${metrics.literatureDepthScore} · ` +
    `${densifyNext.filter((d) => d.priority === "high").length} high densify action(s)`;

  return {
    schema: AI_GUIDANCE_SCHEMA,
    cid: dossier.cid,
    moleculeName: dossier.identity?.name,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    ingestScore: score,
    summary,
    procedureWindows: windows.slice(0, 16),
    processAtoms,
    conditionSummaries,
    openGaps,
    multiSourceHints,
    densifyNext: densifyNext.slice(0, 8),
    metrics,
  };
}

/**
 * Flatten guidance package into model context (quote-bound, densify-first).
 */
export function formatAiGuidanceContext(
  g: AiGuidancePackage,
  maxChars = 28_000
): string {
  const lines: string[] = [
    `AI_GUIDANCE ${g.schema} CID ${g.cid} ${g.moleculeName || ""}`,
    g.summary,
    g.disclaimer,
    "PRIORITY: procedureWindows + processAtoms only for manufacturing claims.",
    "NEVER invent temperatures, yields, equipment IDs, or plant CPPs.",
  ];
  lines.push("\n## Densify next (do these to improve package)");
  for (const a of g.densifyNext) {
    lines.push(
      `[${a.priority}] ${a.title}: ${a.rationale} | HOW: ${a.how} | GAIN: ${a.expectedGain}`
    );
  }
  lines.push("\n## Process atoms (sourced)");
  for (const a of g.processAtoms.slice(0, 40)) {
    lines.push(
      `ATOM [${a.kind}] ${a.claim}` +
        (a.value ? ` = ${a.value}${a.unit ? " " + a.unit : ""}` : "") +
        (a.quote ? ` QUOTE: ${a.quote}` : "") +
        ` SRC: ${a.sourceLabel}`
    );
  }
  lines.push("\n## Condition atlas");
  for (const s of g.conditionSummaries) lines.push(s);
  lines.push("\n## Procedure windows (densify-first)");
  for (const w of g.procedureWindows.slice(0, 12)) {
    lines.push(
      `WINDOW score=${w.score} chars=${w.chars} [${w.source}] ${w.label}\n${w.text.slice(0, 1800)}`
    );
  }
  if (g.multiSourceHints.length) {
    lines.push("\n## Multi-source identity/EHS hints");
    for (const h of g.multiSourceHints.slice(0, 12)) lines.push(h);
  }
  if (g.openGaps.length) {
    lines.push("\n## Open gaps (honest)");
    for (const g0 of g.openGaps) lines.push(`GAP: ${g0}`);
  }
  const blob = lines.join("\n");
  return blob.length > maxChars ? blob.slice(0, maxChars - 1) + "…" : blob;
}

/** Download densify-first AI guidance JSON for agents / notebooks */
export function downloadAiGuidancePackage(dossier: LiveDossier): void {
  const data = buildAiGuidancePackage(dossier);
  const name = (dossier.identity?.name || `cid-${dossier.cid}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 48);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-guidance-${name}-${dossier.cid}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
