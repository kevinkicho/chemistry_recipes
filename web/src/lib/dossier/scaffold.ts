/**
 * Minimal pre-AI dossier shell from free public APIs.
 *
 * NEVER creates fake plant steps from PubChem TOC blurbs.
 * NEVER fills Critical parameters / Environment with "not specified…".
 * Real dual-view routes come from Ollama synthesis; fallback uses only
 * process-looking literature / patent abstracts.
 */

import {
  filterUsefulTexts,
  looksLikeProcessLiterature,
} from "@/lib/dossier/evidenceFilter";
import { scoreCompoundEvidence } from "@/lib/dossier/evidenceScore";
import {
  extractProcessFacts,
  routesFromProcessFacts,
} from "@/lib/dossier/processFacts";
import type { CompoundEvidence, LiveDossier } from "@/lib/dossier/types";
import { DEFAULT_DOSSIER_DISCLAIMER } from "@/lib/dossier/types";
import type {
  HazardSummary,
  ProcessRoute,
  ProcessStep,
  SourceRef,
} from "@/lib/types/process";

function editorialRefs(cid: number): SourceRef[] {
  return [
    {
      type: "editorial",
      id: `evidence-shell:${cid}`,
      label: "Free public API shell (awaiting or without AI routes)",
      note: "Not a curated Tier A dossier; not GMP",
    },
  ];
}

/**
 * Build literature/patent-backed process *leads* only — no placeholder IPC/CQAs.
 * Manufacturing column intentionally sparse until AI or real process evidence.
 */
export function scaffoldRoutesFromEvidence(evidence: CompoundEvidence): ProcessRoute[] {
  const bundle = evidence.processFacts ?? extractProcessFacts(evidence);
  // Prefer fact-enriched leads when extraction found anything usable
  if (
    bundle.facts.some((f) => f.kind === "condition" || f.kind === "unit-op") ||
    bundle.productionBriefEligible
  ) {
    return routesFromProcessFacts(evidence, bundle);
  }

  const name = evidence.identity?.name || `CID ${evidence.cid}`;
  const refs = editorialRefs(evidence.cid);

  const processLit = evidence.literature.filter((h) =>
    looksLikeProcessLiterature(h.title, h.abstract)
  );
  const processPatents = evidence.patents.filter((p) =>
    looksLikeProcessLiterature(p.title, p.abstract)
  );

  const steps: ProcessStep[] = [];
  let order = 1;

  for (const paper of processLit.slice(0, 5)) {
    const abstract = (paper.abstract || "").trim();
    if (!abstract && !paper.title) continue;
    steps.push({
      id: `lit-${order}`,
      order: order++,
      title: paper.title.slice(0, 120),
      description:
        abstract ||
        `Process-related literature (${[paper.journal, paper.year].filter(Boolean).join(" · ")}). Open the source for experimental detail.`,
      mechanismClass: "Literature process lead",
      mechanismNotes: [
        paper.journal && paper.year ? `${paper.journal} (${paper.year})` : paper.year,
        paper.url,
      ]
        .filter(Boolean)
        .join(" · "),
      // No fake environment / controls / apparatus
      sourceRefs: [
        {
          type: "literature",
          id: paper.id,
          label: paper.title.slice(0, 80),
          url: paper.url,
        },
      ],
    });
  }

  for (const p of processPatents.slice(0, 3)) {
    const abstract = (p.abstract || "").trim();
    steps.push({
      id: `pat-${order}`,
      order: order++,
      title: p.title.slice(0, 120),
      description:
        abstract ||
        `Process / IP record ${p.patentNumber}. Review claims and description for manufacturing language.`,
      mechanismClass: "Patent process lead",
      mechanismNotes: [p.patentNumber, p.date, p.url].filter(Boolean).join(" · "),
      sourceRefs: [
        {
          type: "patent",
          id: p.id,
          label: p.title.slice(0, 80),
          url: p.url,
        },
      ],
    });
  }

  if (steps.length === 0) {
    // Single honest stub — dual view will show description only, no fake plant fields
    steps.push({
      id: "await-ai-1",
      order: 1,
      title: "Process route synthesis pending",
      description: `No process-oriented literature or patent abstracts were retrieved yet for ${name}. Ollama synthesis (when available) builds dual-view manufacturing routes from free public evidence. Open PubChem, literature, and patent panels below for raw sources.`,
      mechanismClass: "Evidence gap",
      sourceRefs: refs,
    });
  }

  const mfgUseful = filterUsefulTexts(evidence.view?.manufacturingTexts ?? []);
  const summaryBits = [
    mfgUseful[0],
    processLit[0]
      ? `Process literature includes work such as “${processLit[0].title.slice(0, 100)}”.`
      : null,
    processPatents[0]
      ? `Related IP: “${processPatents[0].title.slice(0, 100)}”.`
      : null,
  ].filter(Boolean);

  const route: ProcessRoute = {
    id: "public-evidence-leads",
    name:
      steps.some((s) => s.id.startsWith("lit") || s.id.startsWith("pat"))
        ? `${name} — public process leads`
        : `${name} — awaiting process synthesis`,
    type: processPatents.length ? "industrial" : "literature",
    preference: 1,
    scaleClass: "lab",
    summary:
      summaryBits.join(" ") ||
      `Identity and hazards from free public APIs. Process steps require literature/patent evidence or Ollama synthesis.`,
    advantages: [
      "Steps cite Europe PMC / patent records when available",
      "No invented temperatures, yields, or IPC placeholders",
    ],
    disadvantages: [
      "Not a validated plant procedure",
      "Full dual-view manufacturing detail needs AI synthesis or primary process literature",
    ],
    materials: [],
    steps,
    scaleUp: undefined,
    sourceRefs: refs,
  };

  return [route];
}

export function buildScaffoldDossier(evidence: CompoundEvidence): LiveDossier {
  const hazards: HazardSummary = {
    signalWord: evidence.view?.hazards.signalWord,
    ghsPictograms: evidence.view?.hazards.pictograms,
    hazardStatements: evidence.view?.hazards.hazardStatements,
    precautionaryStatements: evidence.view?.hazards.precautionaryStatements,
    notes:
      evidence.view?.hazards.rawBlocks.length === 0
        ? "No GHS / safety section text returned from PubChem PUG View for this CID."
        : "Hazard text extracted from PubChem PUG View (public annotations).",
    sourceRefs: [
      {
        type: "api",
        id: `pubchem-view-ghs:${evidence.cid}`,
        label: "PubChem PUG View · GHS / Safety",
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${evidence.cid}#section=Safety-and-Hazards`,
      },
    ],
  };

  const name = evidence.identity?.name || `CID ${evidence.cid}`;
  const desc = filterUsefulTexts(evidence.view?.descriptionTexts ?? []);
  // Keep more manufacturing/use text on the dossier (UI panels + process facts)
  let mfg = filterUsefulTexts(evidence.view?.manufacturingTexts ?? []);
  if (mfg.length === 0 && evidence.view?.blocks?.length) {
    // Last resort: any non-boilerplate block under Use and Manufacturing TOC path
    mfg = filterUsefulTexts(
      evidence.view.blocks
        .filter((b) =>
          /use and manufacturing|methods of manufacturing|industry uses|formulations/i.test(
            b.heading
          )
        )
        .map((b) => b.text)
    );
  }
  const props = filterUsefulTexts(evidence.view?.propertyTexts ?? []);

  const useSnippets = mfg
    .filter((t) => /use|application|indication|supplement|medication|industrial/i.test(t))
    .slice(0, 6);

  const overviewParts = [
    desc[0],
    useSnippets[0],
    evidence.identity?.formula
      ? `${name} (${evidence.identity.formula}${
          evidence.identity.molecularWeight
            ? `, ${evidence.identity.molecularWeight} g/mol`
            : ""
        }) resolved via PubChem CID ${evidence.cid}.`
      : null,
  ].filter(Boolean);

  const processFacts = evidence.processFacts ?? extractProcessFacts(evidence);
  const processRoutes = scaffoldRoutesFromEvidence({
    ...evidence,
    processFacts,
  });
  const hasSubstance =
    Boolean(evidence.identity) ||
    Boolean(evidence.view?.blocks.length) ||
    evidence.literature.length > 0;

  // Applications from real use text only
  const applications = useSnippets
    .map((t) => t.replace(/^[^:]+:\s*/, "").slice(0, 120))
    .filter((t) => t.length > 8)
    .slice(0, 8);

  const scored = scoreCompoundEvidence({ ...evidence, processFacts });

  return {
    tier: hasSubstance ? "B" : "C",
    cid: evidence.cid,
    identity: evidence.identity,
    hazards,
    manufacturingTexts: mfg,
    propertyTexts: props,
    descriptionTexts: desc,
    literature: evidence.literature,
    patents: evidence.patents,
    annotations: evidence.annotations ?? [],
    processFacts,
    // Keep densify windows on the live dossier so agents can ingest without re-gather
    procedureExcerpts: (evidence.procedureExcerpts || [])
      .slice()
      .sort((a, b) => (b.chars || b.text.length) - (a.chars || a.text.length))
      .slice(0, 64),
    processFraming: processFacts.framing,
    synthesis: {
      available: false,
      parsed: false,
      overview:
        overviewParts.join(" ") ||
        `${name}: public identity from free multi-source APIs (PubChem, ChEMBL, openFDA, literature).`,
      applications,
      manufacturingSummary: mfg.slice(0, 4).join(" ") || undefined,
      // Only real GHS lines — never generic placeholder apparatus
      ehsHighlights: (hazards.hazardStatements ?? []).slice(0, 10),
      apparatusCatalog: undefined,
      environmentBaseline: undefined,
      gaps: [
        "Manufacturing conditions appear only when extracted from free-public patents/literature text",
        "Validated IPC/CPP/hold times are site QMS only — never invented here",
        processFacts.summary,
        ...processFacts.openGaps.slice(0, 3),
        ...scored.reasons.slice(0, 3),
      ],
      confidence: scored.confidence,
    },
    traces: evidence.traces,
    sourceRefs: evidence.sourceRefs,
    processRoutes,
    disclaimer: DEFAULT_DOSSIER_DISCLAIMER,
    generatedAt: new Date().toISOString(),
    evidenceScore: {
      score: scored.score,
      confidence: scored.confidence,
      shouldSynthesize: scored.shouldSynthesize,
      preferFastModel: scored.preferFastModel,
      reasons: scored.reasons,
      processLitCount: scored.processLitCount,
      processPatentCount: scored.processPatentCount,
      processFactConditions: scored.processFactConditions,
      unitOpFacts: scored.unitOpFacts,
      productionBriefEligible: scored.productionBriefEligible,
      explainer: scored.explainer,
      aiRecommendation: scored.aiRecommendation,
    },
    buildMode: "evidence-shell",
  };
}
