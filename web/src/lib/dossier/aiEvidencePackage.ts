/**
 * Budgeted free-public evidence package for Ollama / agentic synthesis.
 *
 * Priority order (never invent data — only structure what was harvested):
 * 1. processFacts atoms (grounding law)
 * 2. procedureExcerpts (OA full text, patent windows, OrgSyn, ORD)
 * 3. densified literature / patents
 * 4. manufacturing + GHS
 * 5. multi-source annotations / identity
 *
 * Goal: high-value agentic output from denser multi-API harvest.
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import type { AiDataFeedSource } from "@/lib/dossier/types";
import { looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";

/** Full-model budget — denser multi-pass harvest needs more headroom */
export const MAX_EVIDENCE_CHARS_FULL = 32_000;
/** Draft/fast model keeps a tighter package for latency */
export const MAX_EVIDENCE_CHARS_FAST = 16_000;

function processScore(title: string, body?: string): number {
  const t = `${title} ${body || ""}`;
  let s = 0;
  if (/synthes|manufactur|process|ferment|preparat|industrial|scale|crystal|hydrogen/i.test(t))
    s += 3;
  if (/example\s+\d+|procedure|°\s*C|equiv/i.test(t)) s += 2;
  if ((body?.length || 0) > 400) s += 1;
  return s;
}

function jsonSize(obj: unknown): number {
  return JSON.stringify(obj).length;
}

/**
 * Build a structured evidence object with densified procedure windows first.
 */
export function buildEvidenceObject(
  ev: CompoundEvidence,
  opts?: { preferFast?: boolean }
): Record<string, unknown> {
  const maxChars = opts?.preferFast
    ? MAX_EVIDENCE_CHARS_FAST
    : MAX_EVIDENCE_CHARS_FULL;

  const litSorted = [...ev.literature].sort((a, b) => {
    const sa =
      processScore(a.title, a.fullTextExcerpt || a.abstract) +
      (a.fullTextExcerpt ? 4 : 0);
    const sb =
      processScore(b.title, b.fullTextExcerpt || b.abstract) +
      (b.fullTextExcerpt ? 4 : 0);
    return sb - sa;
  });

  const patSorted = [...ev.patents].sort((a, b) => {
    const sa =
      processScore(a.title, a.procedureExcerpt || a.abstract) +
      (a.procedureExcerpt ? 4 : 0);
    const sb =
      processScore(b.title, b.procedureExcerpt || b.abstract) +
      (b.procedureExcerpt ? 4 : 0);
    return sb - sa;
  });

  const pf = ev.processFacts;
  const procedureExcerpts = [...(ev.procedureExcerpts || [])]
    .sort((a, b) => (b.chars || b.text.length) - (a.chars || a.text.length))
    .slice(0, opts?.preferFast ? 12 : 24)
    .map((p) => ({
      id: p.id,
      source: p.source,
      label: p.label,
      text: p.text.slice(0, opts?.preferFast ? 1200 : 2200),
      url: p.url,
      chars: p.chars || p.text.length,
    }));

  const atoms = (pf?.facts || [])
    .filter((f) => f.kind !== "open-gap")
    .slice(0, opts?.preferFast ? 36 : 64)
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

  const core: Record<string, unknown> = {
    agenticBrief: {
      framing: pf?.framing || "evidence-lead-pack",
      productionBriefEligible: pf?.productionBriefEligible || false,
      procedureExcerptCount: procedureExcerpts.length,
      procedureChars: procedureExcerpts.reduce(
        (n, p) => n + (p.chars || 0),
        0
      ),
      instruction:
        "STRUCTURE the densest procedureExcerpts + processFacts.atoms into dual-view plant routes. " +
        "Ground every numeric condition on an atom quote or procedure excerpt. " +
        "Prefer fewer high-evidence steps over many thin ones. " +
        "Use externalAnnotations for identity/EHS/regulatory context only — not invented unit ops.",
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
      value: patSorted.slice(0, opts?.preferFast ? 6 : 12).map((p) => ({
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
    "Use procedureExcerpts and processFacts.atoms as primary manufacturing signal. " +
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
