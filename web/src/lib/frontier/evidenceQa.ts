/**
 * Evidence-grounded seed Q&A + next-experiment generator.
 * Answers only from free-public package text; insufficientEvidence is first-class.
 * Harvest failure is not "No route hypotheses assembled" / a clean insufficient miss.
 * Leftover identity / annotation HTTP is not a science-QA miss.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ConditionAtlas } from "@/lib/frontier/types";
import { formatProcessFactsEmptyCopy } from "@/lib/dossier/sectionHonesty";
import type {
  EvidenceAnswer,
  NextExperiment,
  RouteHypothesis,
  ScientificConflict,
} from "@/lib/frontier/types";


/**
 * Evidence-science Q&A comes from literature / patent / manufacturing harvest.
 * Harvest failure is not "No route hypotheses assembled" / a clean insufficient miss.
 * Leftover identity / annotation HTTP is not a science-QA miss.
 */
function honestScienceQaAnswer(dossier: LiveDossier, cleanEmpty: string): string {
  const harvest = formatProcessFactsEmptyCopy({
    traces: dossier.traces,
    fetchErrors: dossier.fetchErrors,
  });
  return harvest.kind === "error" ? harvest.message : cleanEmpty;
}

function packageBlob(
  dossier: LiveDossier,
  atlas: ConditionAtlas,
  hypotheses: RouteHypothesis[]
): string {
  const parts: string[] = [];
  parts.push(atlas.summary);
  for (const d of atlas.distributions) {
    parts.push(d.summary);
    for (const o of d.observations.slice(0, 5)) {
      parts.push(o.quote);
    }
  }
  for (const h of hypotheses) {
    parts.push(h.name, h.summary, ...h.killCriteria, ...h.openQuestions);
    for (const s of h.steps) parts.push(s.title, s.summary);
  }
  for (const f of dossier.processFacts?.facts || []) {
    if (f.kind === "open-gap") continue;
    parts.push(f.claim, f.quote || "");
  }
  for (const t of dossier.manufacturingTexts || []) parts.push(t);
  for (const h of (dossier.literature || []).slice(0, 8)) {
    parts.push(h.title, h.abstract || "", h.fullTextExcerpt || "");
  }
  for (const p of (dossier.patents || []).slice(0, 8)) {
    parts.push(p.title, p.abstract || "", p.procedureExcerpt || "");
  }
  return parts.join("\n").toLowerCase();
}

function findCitations(
  dossier: LiveDossier,
  atlas: ConditionAtlas,
  needles: string[]
): EvidenceAnswer["citations"] {
  const cites: EvidenceAnswer["citations"] = [];
  const n = needles.map((x) => x.toLowerCase()).filter((x) => x.length >= 3);

  for (const d of atlas.distributions) {
    for (const o of d.observations.slice(0, 8)) {
      const hay = (o.quote + o.raw).toLowerCase();
      if (n.some((x) => hay.includes(x) || o.kind.includes(x))) {
        cites.push({
          label: o.sourceLabel,
          url: o.sourceUrl,
          quote: o.quote.slice(0, 180),
        });
      }
      if (cites.length >= 6) return cites;
    }
  }
  for (const h of (dossier.literature || []).slice(0, 10)) {
    const hay = `${h.title} ${h.abstract || ""}`.toLowerCase();
    if (n.some((x) => hay.includes(x))) {
      cites.push({
        label: h.title.slice(0, 80),
        url: h.url,
        quote: (h.abstract || h.fullTextExcerpt || "").slice(0, 160),
      });
    }
    if (cites.length >= 6) break;
  }
  for (const p of (dossier.patents || []).slice(0, 10)) {
    const hay = `${p.title} ${p.abstract || ""}`.toLowerCase();
    if (n.some((x) => hay.includes(x))) {
      cites.push({
        label: p.patentNumber || p.title.slice(0, 80),
        url: p.url,
        quote: (p.procedureExcerpt || p.abstract || "").slice(0, 160),
      });
    }
    if (cites.length >= 6) break;
  }
  return cites.slice(0, 6);
}

const SEED_QUESTIONS: Array<{
  id: string;
  question: string;
  needles: string[];
  build: (ctx: {
    dossier: LiveDossier;
    atlas: ConditionAtlas;
    hypotheses: RouteHypothesis[];
    blob: string;
  }) => { answer: string; grounded: boolean; insufficient: boolean };
}> = [
  {
    id: "q-temp",
    question: "What temperature ranges appear in free-public process text?",
    needles: ["°c", "temperature", "heated", "reflux"],
    build: ({ atlas, dossier }) => {
      const d = atlas.distributions.find((x) => x.kind === "temperature");
      if (!d || d.n === 0) {
        return {
          answer: honestScienceQaAnswer(
            dossier,
            "Insufficient free-public temperature mentions in densified windows. Densify OA full text / patent examples or paste public procedures."
          ),
          grounded: false,
          insufficient: true,
        };
      }
      return {
        answer: d.summary + (d.conflict ? ` Conflict: ${d.conflictNote}` : ""),
        grounded: true,
        insufficient: false,
      };
    },
  },
  {
    id: "q-routes",
    question: "What competing public process hypotheses exist?",
    needles: ["route", "process", "synthesis", "preparation"],
    build: ({ hypotheses, dossier }) => {
      if (!hypotheses.length || hypotheses[0]?.id === "hyp-none") {
        return {
          answer: honestScienceQaAnswer(
            dossier,
            "No route hypotheses assembled from free-public evidence yet."
          ),
          grounded: false,
          insufficient: true,
        };
      }
      const lines = hypotheses.slice(0, 4).map(
        (h) =>
          `• ${h.name} [${h.status}, evidence ${h.evidenceScore}/100]: ${h.summary.slice(0, 160)}`
      );
      return {
        answer: lines.join("\n"),
        grounded: true,
        insufficient: hypotheses.every((h) => h.status === "thin-lead"),
      };
    },
  },
  {
    id: "q-haz",
    question: "What process-hazard language appears in public sources?",
    needles: ["exotherm", "hydrogen", "h2", "flammable", "corrosive", "anhydride"],
    build: ({ dossier, blob }) => {
      const ehs = [
        ...(dossier.synthesis.ehsHighlights || []),
        ...(dossier.hazards.hazardStatements || []).slice(0, 6),
      ];
      const proc = blob.match(
        /exotherm|runaway|hydrogen|h2\b|pyrophoric|peroxide|scrubber|flammable/gi
      );
      if (!ehs.length && !proc?.length) {
        return {
          answer: honestScienceQaAnswer(
            dossier,
            "Insufficient process-hazard narrative beyond sparse GHS (if any). Do not invent plant EHS controls."
          ),
          grounded: Boolean(dossier.hazards.hazardStatements?.length),
          insufficient: true,
        };
      }
      return {
        answer: [
          ehs.length ? `EHS/GHS cues: ${ehs.slice(0, 5).join(" · ")}` : null,
          proc?.length
            ? `Process-hazard tokens in public text: ${[...new Set(proc)].slice(0, 8).join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
        grounded: true,
        insufficient: false,
      };
    },
  },
  {
    id: "q-impurity",
    question: "What impurities / residuals are named in public evidence?",
    needles: ["impurity", "residual", "starting material", "byproduct", "by-product"],
    build: ({ dossier }) => {
      const imps = (dossier.relatedEntities || []).filter((e) =>
        /impurity|intermediate|starting/i.test(e.role)
      );
      if (!imps.length) {
        return {
          answer: honestScienceQaAnswer(
            dossier,
            "No impurity/intermediate entities extracted from free-public evidence for this capture."
          ),
          grounded: false,
          insufficient: true,
        };
      }
      return {
        answer: imps
          .slice(0, 8)
          .map((e) => `${e.role}: ${e.name}${e.notes ? ` — ${e.notes.slice(0, 100)}` : ""}`)
          .join("\n"),
        grounded: true,
        insufficient: false,
      };
    },
  },
  {
    id: "q-gap",
    question: "What is the strongest evidence gap blocking a recipe-grade public path?",
    needles: ["gap", "missing", "densify", "example"],
    build: ({ dossier, atlas, hypotheses }) => {
      const harvest = formatProcessFactsEmptyCopy({
        traces: dossier.traces,
        fetchErrors: dossier.fetchErrors,
      });
      if (harvest.kind === "error") {
        return {
          answer: harvest.message,
          grounded: false,
          insufficient: true,
        };
      }
      const gaps = [
        ...(dossier.recipeReadiness?.gaps || []).map((g) => g.label),
        ...(dossier.processFacts?.openGaps || []),
      ];
      if (atlas.observationCount < 3) {
        gaps.unshift("Condition atlas nearly empty — need densified procedure windows");
      }
      if (hypotheses.every((h) => h.status === "thin-lead" || h.status === "teaching-baseline")) {
        gaps.unshift("No evidence-backed live route hypothesis yet");
      }
      if (!gaps.length) {
        return {
          answer:
            "No major checklist gaps recorded; still validate every number against primary sources before plant use.",
          grounded: true,
          insufficient: false,
        };
      }
      return {
        answer: gaps.slice(0, 6).map((g) => `• ${g}`).join("\n"),
        grounded: true,
        insufficient: atlas.observationCount < 3,
      };
    },
  },
];

/**
 * Seed evidence answers (deterministic, package-grounded).
 */
export function buildSeedAnswers(
  dossier: LiveDossier,
  atlas: ConditionAtlas,
  hypotheses: RouteHypothesis[]
): EvidenceAnswer[] {
  const blob = packageBlob(dossier, atlas, hypotheses);
  return SEED_QUESTIONS.map((q) => {
    const built = q.build({ dossier, atlas, hypotheses, blob });
    const citations = built.grounded
      ? findCitations(dossier, atlas, q.needles)
      : [];
    return {
      id: q.id,
      question: q.question,
      answer: built.answer,
      grounded: built.grounded,
      citations,
      insufficientEvidence: built.insufficient,
    };
  });
}

/**
 * Next experiments from conflicts, thin hypotheses, and atlas gaps.
 * Experiments are research questions — not plant setpoints.
 */
export function buildNextExperiments(
  dossier: LiveDossier,
  atlas: ConditionAtlas,
  hypotheses: RouteHypothesis[],
  conflicts: ScientificConflict[]
): NextExperiment[] {
  const out: NextExperiment[] = [];
  let i = 0;

  for (const c of conflicts.filter((x) => x.severity === "warning").slice(0, 4)) {
    out.push({
      id: `exp:conf:${i++}`,
      question: c.resolvingExperiment || `Resolve conflict: ${c.topic}`,
      rationale: `${c.sideA} vs ${c.sideB}`,
      gap: c.topic,
      priority: "high",
      relatedConflictIds: [c.id],
    });
  }

  const temp = atlas.distributions.find((d) => d.kind === "temperature");
  if (!temp || temp.n < 2) {
    out.push({
      id: `exp:temp:${i++}`,
      question:
        "Survey free-public full-text examples for temperature windows on the key transformation",
      rationale:
        "Condition atlas lacks enough temperature mentions to describe a public condition space",
      gap: "Sparse temperature observations",
      priority: "high",
    });
  } else if (temp.conflict) {
    out.push({
      id: `exp:temp-conflict:${i++}`,
      question:
        "Experimentally map conversion vs temperature across the public conflicting windows (research scale)",
      rationale: temp.conflictNote || temp.summary,
      gap: "Non-overlapping public temperature ranges",
      priority: "high",
    });
  }

  for (const h of hypotheses.filter((x) => x.status === "thin-lead").slice(0, 2)) {
    out.push({
      id: `exp:hyp:${i++}`,
      question: `Densify sources for “${h.name.slice(0, 60)}” until unit-ops and conditions are quote-grounded — or kill the lead`,
      rationale: h.openQuestions[0] || h.summary,
      gap: "Thin public lead",
      priority: "medium",
      relatedHypothesisIds: [h.id],
    });
  }

  if ((dossier.relatedEntities || []).filter((e) => e.role === "impurity").length === 0) {
    out.push({
      id: `exp:imp:${i++}`,
      question:
        "Mine patents/OA experimental sections for named impurities / residual SM of this API",
      rationale: "No impurity entities extracted from free-public evidence",
      gap: "Impurity network empty",
      priority: "medium",
    });
  }

  if (atlas.solvents.length >= 2) {
    const a = atlas.solvents[0]!;
    const b = atlas.solvents[1]!;
    out.push({
      id: `exp:solv:${i++}`,
      question: `Compare ${a.name} vs ${b.name} for the key step under controlled lab conditions (public texts mention both)`,
      rationale: `Solvent cues: ${a.name} (n=${a.n}), ${b.name} (n=${b.n})`,
      gap: "Solvent split in public text",
      priority: "low",
    });
  }

  if (!out.length) {
    out.push({
      id: `exp:baseline:${i++}`,
      question:
        "Increase densified procedure characters (OA + patent examples), then re-run atlas and hypotheses",
      rationale: "Package is too thin for specific experimental discrimination",
      gap: "Overall evidence density",
      priority: "high",
    });
  }

  return out.slice(0, 12);
}

/**
 * Answer a free-form question against the package (keyword retrieval).
 * For interactive UI; seed answers cover the default science questions.
 */
export function answerFromEvidencePackage(
  question: string,
  dossier: LiveDossier,
  atlas: ConditionAtlas,
  hypotheses: RouteHypothesis[]
): EvidenceAnswer {
  const q = question.trim();
  const blob = packageBlob(dossier, atlas, hypotheses);
  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9°%]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 12);

  // Prefer seed match
  const seed = buildSeedAnswers(dossier, atlas, hypotheses);
  const hit = seed.find((s) =>
    tokens.some(
      (t) =>
        s.question.toLowerCase().includes(t) ||
        s.answer.toLowerCase().includes(t)
    )
  );
  if (hit && tokens.some((t) => hit.question.toLowerCase().includes(t))) {
    return { ...hit, id: `live:${hit.id}`, question: q };
  }

  const hasAny = tokens.some((t) => blob.includes(t));
  const citations = findCitations(dossier, atlas, tokens);
  if (!hasAny || citations.length === 0) {
    return {
      id: `live:${Date.now()}`,
      question: q,
      answer: honestScienceQaAnswer(
        dossier,
        "Insufficient free-public evidence in the current densified package to answer. Densify OA/patent full text, paste public procedures, or narrow the question to temperature/routes/hazards/impurities."
      ),
      grounded: false,
      citations: [],
      insufficientEvidence: true,
    };
  }

  // Pull top quotes
  const quotes = citations
    .map((c) => (c.quote ? `“${c.quote}” — ${c.label}` : c.label))
    .slice(0, 4);
  return {
    id: `live:${Date.now()}`,
    question: q,
    answer: `Evidence snippets related to your question (not a complete answer):\n${quotes.join("\n")}\n\nInterpret only with primary sources open; this is retrieval over free-public text, not a plant recommendation.`,
    grounded: true,
    citations,
    insufficientEvidence: citations.length < 2,
  };
}
