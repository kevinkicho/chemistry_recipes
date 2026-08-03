/**
 * Budgeted free-public evidence package for Ollama / agentic synthesis.
 *
 * Value-weighted priority (never invent data — only structure what was harvested):
 * 1. processFacts atoms (grounding law) — conditions/yields first
 * 2. procedureExcerpts ranked by procedure-window score
 * 3. relatedProcessContext + processKnowledgeDigest
 * 4. densified process literature / patents
 * 5. manufacturing + GHS
 * 6. multi-source annotations / identity (context only)
 *
 * Goal: high-value agentic output from denser multi-API harvest.
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import type { AiDataFeedSource } from "@/lib/dossier/types";
import { looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";
import {
  scoreProcessRelevance,
  splitProcessVsClinicalLiterature,
} from "@/lib/literature/rank";
import { scoreProcedureWindow } from "@/lib/literature/procedureWindowScore";
import { rankProcedureTextsForPack } from "@/lib/dossier/densifyBudgetPlanner";
import {
  buildRelatedProcessContext,
  formatRelatedContextForPrompt,
} from "@/lib/dossier/relatedContextPackage";
import { buildProcessKnowledgeDigest } from "@/lib/dossier/processKnowledgeDigest";

/** Full-model budget — denser multi-pass harvest needs more headroom */
export const MAX_EVIDENCE_CHARS_FULL = 32_000;
/** Draft/fast model keeps a tighter package for latency */
export const MAX_EVIDENCE_CHARS_FAST = 16_000;

const ATOM_KIND_WEIGHT: Record<string, number> = {
  condition: 50,
  yield: 45,
  purity: 42,
  workup: 38,
  isolation: 36,
  "unit-op": 35,
  material: 30,
  "scale-note": 28,
  "hazard-process": 22,
  other: 10,
  "open-gap": 0,
};

function processScore(title: string, body?: string): number {
  const t = `${title} ${body || ""}`;
  let s = 0;
  if (/synthes|manufactur|process|ferment|preparat|industrial|scale|crystal|hydrogen/i.test(t))
    s += 3;
  if (/example\s+\d+|procedure|°\s*C|equiv/i.test(t)) s += 2;
  if ((body?.length || 0) > 400) s += 1;
  // Procedure-window markers elevate densified hits
  s += Math.min(6, Math.floor(scoreProcedureWindow(body || title) / 4));
  return s;
}

function atomRank(kind: string | undefined, claim: string, quote?: string): number {
  const k = (kind || "other").toLowerCase();
  const base = ATOM_KIND_WEIGHT[k] ?? 12;
  const q = quote?.length || 0;
  const hasNum = /\d/.test(`${claim} ${quote || ""}`) ? 8 : 0;
  return base + Math.min(15, Math.floor(q / 40)) + hasNum;
}

function jsonSize(obj: unknown): number {
  return JSON.stringify(obj).length;
}

/**
 * Build a structured evidence object with densified procedure windows first.
 * Layers fill remaining budget in value order (drop low-value first).
 */
export function buildEvidenceObject(
  ev: CompoundEvidence,
  opts?: { preferFast?: boolean }
): Record<string, unknown> {
  const maxChars = opts?.preferFast
    ? MAX_EVIDENCE_CHARS_FAST
    : MAX_EVIDENCE_CHARS_FULL;
  const preferFast = Boolean(opts?.preferFast);

  // Prefer process/manufacturing lit for dual-view routes; clinical is context only
  const { process: processLit, clinical: clinicalLit } =
    splitProcessVsClinicalLiterature(ev.literature || []);
  const litProcessSorted = processLit.sort((a, b) => {
    const sa =
      scoreProcessRelevance(a.title, a.fullTextExcerpt || a.abstract) +
      (a.fullTextExcerpt ? 8 : 0) +
      processScore(a.title, a.fullTextExcerpt || a.abstract);
    const sb =
      scoreProcessRelevance(b.title, b.fullTextExcerpt || b.abstract) +
      (b.fullTextExcerpt ? 8 : 0) +
      processScore(b.title, b.fullTextExcerpt || b.abstract);
    return sb - sa;
  });
  // Process first; clinical capped and tagged so overview doesn't lead with MoA
  const litSorted = [
    ...litProcessSorted,
    ...clinicalLit.slice(0, preferFast ? 2 : 4),
  ];

  const patSorted = [...ev.patents]
    .filter((p) => looksLikeProcessLiterature(p.title, p.abstract) || Boolean(p.procedureExcerpt))
    .sort((a, b) => {
      const sa =
        processScore(a.title, a.procedureExcerpt || a.abstract) +
        (a.procedureExcerpt ? 4 : 0) +
        scoreProcedureWindow(a.procedureExcerpt || a.abstract);
      const sb =
        processScore(b.title, b.procedureExcerpt || b.abstract) +
        (b.procedureExcerpt ? 4 : 0) +
        scoreProcedureWindow(b.procedureExcerpt || b.abstract);
      return sb - sa;
    });
  // If filter emptied patents, fall back to raw list (still densified xrefs)
  const patFinal =
    patSorted.length > 0
      ? patSorted
      : [...ev.patents].sort(
          (a, b) =>
            processScore(b.title, b.abstract) - processScore(a.title, a.abstract)
        );

  const pf = ev.processFacts;

  // Value-weighted procedure windows (procedure-score, not just length)
  const rankedWindows = rankProcedureTextsForPack(
    (ev.procedureExcerpts || []).map((p) => ({
      id: p.id,
      text: p.text,
      label: p.label,
      chars: p.chars || p.text.length,
    }))
  );
  const byId = new Map((ev.procedureExcerpts || []).map((p) => [p.id, p]));
  const procedureExcerpts = rankedWindows
    .slice(0, preferFast ? 12 : 24)
    .map((w) => {
      const p = byId.get(w.id)!;
      return {
        id: p.id,
        source: p.source,
        label: p.label,
        text: p.text.slice(0, preferFast ? 1200 : 2200),
        url: p.url,
        chars: p.chars || p.text.length,
        procedureScore: scoreProcedureWindow(p.text),
      };
    });

  // Conditions / yields first among atoms
  const atoms = (pf?.facts || [])
    .filter((f) => f.kind !== "open-gap")
    .slice()
    .sort(
      (a, b) =>
        atomRank(b.kind, b.claim, b.quote) - atomRank(a.kind, a.claim, a.quote)
    )
    .slice(0, preferFast ? 36 : 64)
    .map((f) => ({
      kind: f.kind,
      claim: f.claim,
      value: f.value,
      unit: f.unit,
      quote: f.quote?.slice(0, 280),
      unitOp: f.unitOp,
      exampleRef: f.exampleRef,
      sourceLabel: f.sourceLabel,
      sourceId: f.sourceId,
      provenance: f.provenance,
      sourceUrl: f.sourceUrl,
    }));

  const relatedCtx = buildRelatedProcessContext(ev);
  const relatedBlock = formatRelatedContextForPrompt(relatedCtx);

  // Full condition/unit-op summaries for structure (not invented CPPs)
  const processKnowledgeDigest = buildProcessKnowledgeDigest(ev);

  const core: Record<string, unknown> = {
    agenticBrief: {
      framing: pf?.framing || "evidence-lead-pack",
      productionBriefEligible: pf?.productionBriefEligible || false,
      procedureExcerptCount: procedureExcerpts.length,
      procedureChars: procedureExcerpts.reduce(
        (n, p) => n + (p.chars || 0),
        0
      ),
      packing: "value-weighted",
      instruction:
        "You are the integral AI for a free-public densify dashboard. " +
        "STRUCTURE the densest procedureExcerpts + processFacts.atoms into dual-view plant routes. " +
        "Ground every numeric condition on an atom quote or procedure excerpt. " +
        "overview + manufacturingSummary MUST lead with process/patent manufacturing evidence " +
        "(literatureProcess / patents / procedureExcerpts); put clinical context last. " +
        "Prefer fewer high-evidence steps over many thin ones. " +
        "Use relatedProcessContext for impurity/intermediate awareness only. " +
        "Use externalAnnotations for identity/EHS/regulatory context only — not invented unit ops. " +
        "NEVER invent plant setpoints, IPC methods, or site CPPs.",
      processLitCount: litProcessSorted.length,
      clinicalLitCount: clinicalLit.length,
    },
    processFacts: pf
      ? {
          summary: pf.summary,
          productionBriefEligible: pf.productionBriefEligible,
          framing: pf.framing,
          sourcedConditionCount: pf.sourcedConditionCount,
          unitOpCount: pf.unitOpCount,
          openGaps: pf.openGaps.slice(0, 10),
          managerRisks: pf.managerRisks.slice(0, 10),
          exampleDenseSources: pf.exampleDenseSources?.slice(0, 8),
          ipPointers: pf.ipPointers?.slice(0, 8),
          atoms,
        }
      : undefined,
    procedureExcerpts,
    processKnowledgeDigest,
    identity: ev.identity
      ? {
          name: ev.identity.name,
          formula: ev.identity.formula,
          mw: ev.identity.molecularWeight,
          iupac: ev.identity.iupacName,
          cid: ev.cid,
          smiles: ev.identity.smiles,
          cas: ev.identity.cas,
          inchiKey: ev.identity.inchiKey,
        }
      : { cid: ev.cid },
  };

  // Related CID / impurity context when present
  if (relatedBlock) {
    try {
      const parsed = JSON.parse(relatedBlock) as Record<string, unknown>;
      Object.assign(core, parsed);
    } catch {
      core.relatedProcessContext = {
        summary: relatedCtx.summary,
        entities: relatedCtx.relatedEntities.slice(0, 12),
        impurityMentions: relatedCtx.impurityMentions,
        processHints: relatedCtx.processHints,
      };
    }
  }

  // Fill remaining budget with layered sections
  const layers: Array<{ key: string; value: unknown; minKeep?: boolean }> = [
    {
      key: "manufacturingTexts",
      value: (ev.view?.manufacturingTexts ?? []).slice(
        0,
        opts?.preferFast ? 12 : 24
      ),
    },
    {
      key: "literatureProcess",
      value: litProcessSorted.slice(0, opts?.preferFast ? 8 : 12).map((h) => ({
        id: h.id,
        title: h.title,
        year: h.year,
        journal: h.journal,
        source: h.source,
        tier: "process",
        abstract: (h.abstract || "").slice(0, opts?.preferFast ? 400 : 700),
        fullTextExcerpt: h.fullTextExcerpt
          ? h.fullTextExcerpt.slice(0, opts?.preferFast ? 900 : 1800)
          : undefined,
        url: h.url,
        isOpenAccess: h.isOpenAccess,
        processy: true,
      })),
    },
    {
      key: "literatureClinicalContext",
      value: clinicalLit.slice(0, opts?.preferFast ? 2 : 4).map((h) => ({
        id: h.id,
        title: h.title,
        year: h.year,
        source: h.source,
        tier: "clinical",
        abstract: (h.abstract || "").slice(0, opts?.preferFast ? 200 : 350),
        url: h.url,
        note: "Clinical/PK context only — not process recipe source",
      })),
    },
    {
      key: "literature",
      value: litSorted.slice(0, opts?.preferFast ? 8 : 14).map((h) => ({
        id: h.id,
        title: h.title,
        year: h.year,
        journal: h.journal,
        source: h.source,
        abstract: (h.abstract || "").slice(0, opts?.preferFast ? 400 : 700),
        fullTextExcerpt: h.fullTextExcerpt
          ? h.fullTextExcerpt.slice(0, opts?.preferFast ? 900 : 1800)
          : undefined,
        url: h.url,
        isOpenAccess: h.isOpenAccess,
        processy: looksLikeProcessLiterature(h.title, h.abstract),
      })),
    },
    {
      key: "patents",
      value: patFinal.slice(0, opts?.preferFast ? 6 : 12).map((p) => ({
        id: p.id,
        title: p.title,
        number: p.patentNumber,
        abstract: (p.abstract || "").slice(0, opts?.preferFast ? 400 : 700),
        procedureExcerpt: p.procedureExcerpt
          ? p.procedureExcerpt.slice(0, opts?.preferFast ? 900 : 1800)
          : undefined,
        url: p.url,
        processy: looksLikeProcessLiterature(p.title, p.abstract),
      })),
    },
    {
      key: "hazards",
      value: ev.view?.hazards
        ? {
            signalWord: ev.view.hazards.signalWord,
            hazardStatements: ev.view.hazards.hazardStatements.slice(0, 18),
            precautionaryStatements:
              ev.view.hazards.precautionaryStatements.slice(0, 10),
          }
        : null,
    },
    {
      key: "externalAnnotations",
      value: (ev.annotations ?? []).slice(0, opts?.preferFast ? 14 : 28).map((a) => ({
        source: a.source,
        kind: a.kind,
        title: a.title,
        summary: a.summary?.slice(0, 500),
        fields: a.fields,
        url: a.url,
      })),
    },
    {
      key: "descriptionTexts",
      value: (ev.view?.descriptionTexts ?? []).slice(0, 10),
    },
    {
      key: "propertyTexts",
      value: (ev.view?.propertyTexts ?? []).slice(0, 14),
    },
  ];

  let packed = { ...core };
  for (const layer of layers) {
    const next = { ...packed, [layer.key]: layer.value };
    if (jsonSize(next) <= maxChars) {
      packed = next;
    } else {
      // Try a thinner slice of this layer
      if (Array.isArray(layer.value)) {
        const arr = layer.value as unknown[];
        for (let n = Math.min(arr.length, 4); n >= 1; n--) {
          const slim = { ...packed, [layer.key]: arr.slice(0, n) };
          if (jsonSize(slim) <= maxChars) {
            packed = slim;
            break;
          }
        }
      }
      // Stop adding lower-priority layers once budget is tight
      if (jsonSize(packed) > maxChars * 0.92) break;
    }
  }

  packed.instruction =
    "Produce dual-view process routes for a plant-ready educational dossier. " +
    "Use procedureExcerpts and processFacts.atoms as primary manufacturing signal (value-weighted pack). " +
    "Use processKnowledgeDigest + relatedProcessContext only as structure/impurity cues. " +
    "Use all free-public sources (not only PubChem). Omit empty plant fields rather than placeholders.";

  // Final hard cap (should rarely hit if packing worked)
  const raw = JSON.stringify(packed);
  if (raw.length > maxChars) {
    return {
      ...packed,
      _truncated: true,
      _budget: maxChars,
      procedureExcerpts: procedureExcerpts.slice(0, 8),
      processFacts: packed.processFacts,
      identity: packed.identity,
      agenticBrief: packed.agenticBrief,
    };
  }
  return packed;
}

export function buildEvidencePayload(
  ev: CompoundEvidence,
  opts?: { preferFast?: boolean }
): string {
  const maxChars = opts?.preferFast
    ? MAX_EVIDENCE_CHARS_FAST
    : MAX_EVIDENCE_CHARS_FULL;
  const obj = buildEvidenceObject(ev, opts);
  const raw = JSON.stringify(obj);
  return raw.length > maxChars ? raw.slice(0, maxChars) + "…[truncated]" : raw;
}

/** Inventory of free-public feeds composing the AI evidence package. */
export function buildAiDataFeedSources(ev: CompoundEvidence): AiDataFeedSource[] {
  const sources: AiDataFeedSource[] = [];
  const cid = ev.cid;

  if (ev.identity) {
    sources.push({
      id: `identity:${cid}`,
      name: "PubChem PUG REST · identity",
      organization: "NCBI / NIH",
      role: "Compound identity & properties",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      content: JSON.stringify({
        name: ev.identity.name,
        formula: ev.identity.formula,
        mw: ev.identity.molecularWeight,
        smiles: ev.identity.smiles,
        cid,
      }).slice(0, 800),
    });
  }

  if (ev.processFacts?.facts?.length) {
    const atoms = ev.processFacts.facts
      .filter((f) => f.kind !== "open-gap")
      .slice(0, 20);
    sources.push({
      id: `process-facts:${cid}`,
      name: "Process fact atoms",
      organization: "Chemistry Recipes extractor",
      role: "Sourced conditions / unit ops for grounding",
      content: JSON.stringify(
        atoms.map((f) => ({
          kind: f.kind,
          claim: f.claim,
          value: f.value,
          source: f.sourceLabel,
        }))
      ).slice(0, 1500),
    });
  }

  for (const p of (ev.procedureExcerpts || [])
    .slice()
    .sort((a, b) => (b.chars || 0) - (a.chars || 0))
    .slice(0, 10)) {
    sources.push({
      id: `proc:${p.id}`,
      name: p.label.slice(0, 100),
      organization: p.source,
      role: "Procedure excerpt (OA / patent / OrgSyn / ORD)",
      url: p.url,
      content: p.text.slice(0, 1200),
    });
  }

  for (const a of (ev.annotations ?? []).slice(0, 14)) {
    sources.push({
      id: `ann:${a.source}:${a.title.slice(0, 40)}`,
      name: a.source,
      organization: a.organization,
      role: `${a.kind} annotation`,
      url: a.url,
      endpointUrl: a.endpointUrl,
      content: [a.title, a.summary, a.fields ? JSON.stringify(a.fields) : ""]
        .filter(Boolean)
        .join("\n")
        .slice(0, 700),
    });
  }

  const mfg = (ev.view?.manufacturingTexts ?? []).slice(0, 14);
  if (mfg.length) {
    sources.push({
      id: `mfg:${cid}`,
      name: "PubChem · Use and Manufacturing",
      organization: "NCBI / NIH",
      role: "Manufacturing / use annotations",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Use-and-Manufacturing`,
      content: mfg.join("\n---\n").slice(0, 1400),
    });
  }

  if (ev.view?.hazards) {
    const h = ev.view.hazards;
    sources.push({
      id: `haz:${cid}`,
      name: "PubChem · GHS / hazards",
      organization: "NCBI / NIH",
      role: "Hazard statements for EHS",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Safety-and-Hazards`,
      content: JSON.stringify({
        signalWord: h.signalWord,
        hazardStatements: h.hazardStatements.slice(0, 14),
      }).slice(0, 1000),
    });
  }

  for (const paper of ev.literature.slice(0, 10)) {
    sources.push({
      id: `lit:${paper.id}`,
      name: paper.title.slice(0, 100),
      organization: paper.source || "Literature",
      role: paper.fullTextExcerpt
        ? "Literature + OA procedure window"
        : "Literature title/abstract",
      url: paper.url,
      content: [
        paper.title,
        paper.year,
        paper.journal,
        paper.fullTextExcerpt?.slice(0, 600) || paper.abstract?.slice(0, 400),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 900),
    });
  }

  for (const p of ev.patents.slice(0, 8)) {
    sources.push({
      id: `pat:${p.id}`,
      name: p.title.slice(0, 100),
      organization: "Patents (free public)",
      role: p.procedureExcerpt
        ? "Patent + procedure window"
        : "Patent title/abstract",
      url: p.url,
      content: [
        p.patentNumber,
        p.title,
        p.procedureExcerpt?.slice(0, 600) || p.abstract?.slice(0, 400),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 900),
    });
  }

  return sources;
}
