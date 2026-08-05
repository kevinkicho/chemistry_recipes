/**
 * Competing route hypotheses from free-public evidence + process routes.
 * Kill criteria and open questions — not plant preference decisions.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessRoute, ProcessStep } from "@/lib/types/process";
import type { ConditionAtlas } from "@/lib/frontier/types";
import type {
  EvidenceSourceKind,
  RouteHypothesis,
  RouteHypothesisStatus,
  ScientificConflict,
} from "@/lib/frontier/types";

function isTeaching(r: ProcessRoute): boolean {
  return (
    r.id.startsWith("tier-a-") ||
    /tier-a teaching/i.test(r.name || "") ||
    (r.sourceRefs || []).some((s) => s.id?.includes("tier-a"))
  );
}

function isLitLead(step: ProcessStep): boolean {
  return /literature process lead|patent process lead|scaffold/i.test(
    `${step.mechanismClass || ""} ${step.title || ""}`
  );
}

function stepSupport(step: ProcessStep): string[] {
  const out: string[] = [];
  for (const s of step.sourceRefs || []) {
    if (s.type === "editorial" && s.id?.includes("tier-a")) {
      out.push(s.label || "process source");
      continue;
    }
    if (s.type !== "editorial") out.push(s.label || s.id);
  }
  for (const id of step.factIds || []) out.push(`fact:${id}`);
  return out.slice(0, 8);
}

function stepMissing(step: ProcessStep, teaching: boolean): string[] {
  const miss: string[] = [];
  if (teaching) {
    miss.push("Teaching baseline — confirm every claim against live free-public sources");
    return miss;
  }
  const cond = step.conditions;
  const hasNum =
    cond &&
    Object.values(cond).some(
      (v) => v && /\d/.test(String(v))
    );
  if (!hasNum) miss.push("No sourced numeric conditions on this step");
  if (!step.apparatus?.length) miss.push("No apparatus class from public evidence");
  if (isLitLead(step)) miss.push("Literature/patent lead only — not a full unit-op train");
  if (!(step.sourceRefs || []).some((s) => s.type !== "editorial")) {
    miss.push("Weak non-editorial source linkage");
  }
  return miss;
}

function scoreRoute(r: ProcessRoute, atlas: ConditionAtlas): {
  score: number;
  status: RouteHypothesisStatus;
} {
  if (isTeaching(r)) {
    return { score: 55, status: "teaching-baseline" };
  }
  const steps = r.steps || [];
  if (!steps.length) return { score: 5, status: "thin-lead" };

  let score = 10 + Math.min(30, steps.length * 8);
  const withCond = steps.filter(
    (s) =>
      s.conditions &&
      Object.values(s.conditions).some((v) => v && String(v).trim())
  ).length;
  score += withCond * 10;
  const withSrc = steps.filter((s) =>
    (s.sourceRefs || []).some((x) => x.type !== "editorial")
  ).length;
  score += withSrc * 6;
  score += Math.min(15, atlas.observationCount);
  if (steps.every(isLitLead)) {
    return { score: Math.min(score, 35), status: "thin-lead" };
  }
  if (withCond >= Math.ceil(steps.length / 2) && withSrc > 0) {
    return { score: Math.min(95, score), status: "evidence-backed" };
  }
  return { score: Math.min(70, score), status: "partial" };
}

function killCriteria(
  r: ProcessRoute,
  status: RouteHypothesisStatus,
  atlas: ConditionAtlas
): string[] {
  const kills: string[] = [];
  if (status === "teaching-baseline") {
    kills.push(
      "Kill as research path if live free-public densify yields a conflicting bond-forming sequence"
    );
    kills.push(
      "Kill if primary OA/patent examples never support the teaching unit-op train"
    );
  }
  if (status === "thin-lead") {
    kills.push(
      "Kill if densified full text never produces unit-ops or conditions for this lead"
    );
  }
  const temp = atlas.distributions.find((d) => d.kind === "temperature");
  if (temp?.conflict) {
    kills.push(
      `Temperature conflict in public atlas (${temp.conflictNote || "non-overlapping ranges"}) — resolve experimentally before preferring this path`
    );
  }
  const steps = r.steps || [];
  if (!steps.some((s) => s.materials?.length || r.materials?.length)) {
    kills.push("Kill if no public BOM/materials can be grounded for the sequence");
  }
  if (!kills.length) {
    kills.push(
      "Falsify by showing public sources prefer a different key transformation with higher densified support"
    );
  }
  return kills.slice(0, 6);
}

function openQuestions(r: ProcessRoute, status: RouteHypothesisStatus): string[] {
  const q: string[] = [];
  if (status === "thin-lead" || status === "partial") {
    q.push("Which public full-text example actually operates this sequence end-to-end?");
  }
  if (!(r.steps || []).some((s) => s.controls?.criticalParameters?.length)) {
    q.push("What public sources discuss critical process parameters (not site CPPs)?");
  }
  q.push("How do impurities / residual SM appear in free-public descriptions of this path?");
  if (isTeaching(r)) {
    q.push("Which teaching steps have zero free-public quote support on this CID?");
  }
  return q.slice(0, 5);
}

function sourcesForRoute(r: ProcessRoute): RouteHypothesis["supportingSources"] {
  const out: RouteHypothesis["supportingSources"] = [];
  const seen = new Set<string>();
  const push = (
    label: string,
    kind: EvidenceSourceKind,
    url?: string
  ) => {
    const k = label + (url || "");
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ label, kind, url });
  };
  for (const s of r.sourceRefs || []) {
    push(
      s.label || s.id,
      s.type === "patent"
        ? "patent"
        : s.type === "literature"
          ? "literature"
          : s.id?.includes("tier-a")
            ? "other"
            : "other",
      s.url
    );
  }
  for (const step of r.steps || []) {
    for (const s of step.sourceRefs || []) {
      if (s.type === "editorial" && !s.id?.includes("tier-a")) continue;
      push(
        s.label || s.id,
        s.type === "patent"
          ? "patent"
          : s.type === "literature"
            ? "literature"
            : "other",
        s.url
      );
    }
  }
  return out.slice(0, 12);
}

/**
 * Build competing route hypotheses from dossier process routes + atlas.
 */
export function buildRouteHypotheses(
  dossier: LiveDossier,
  atlas: ConditionAtlas
): RouteHypothesis[] {
  const routes = [...(dossier.processRoutes || [])].sort(
    (a, b) => (a.preference || 99) - (b.preference || 99)
  );
  if (!routes.length) {
    return [
      {
        id: "hyp-none",
        name: "No public process hypothesis yet",
        status: "thin-lead",
        evidenceScore: 0,
        summary:
          "Free-public densify has not assembled a process route. Paste OA/patent experimental text or force densify.",
        steps: [],
        supportingSources: [],
        killCriteria: [
          "N/A — gather densified procedure windows before forming a killable hypothesis",
        ],
        openQuestions: [
          "Is there process literature or patent examples for this CID in free sources?",
        ],
      },
    ];
  }

  return routes.slice(0, 6).map((r, idx) => {
    const teaching = isTeaching(r);
    const { score, status } = scoreRoute(r, atlas);
    const steps = (r.steps || []).slice(0, 12).map((s) => ({
      order: s.order,
      title: s.title,
      summary: (s.description || s.mechanismNotes || "").slice(0, 280),
      unitOp: s.mechanismClass,
      support: stepSupport(s),
      missing: stepMissing(s, teaching),
    }));

    return {
      id: `hyp:${r.id || idx}`,
      name: r.name,
      status,
      evidenceScore: score,
      summary:
        r.summary?.slice(0, 400) ||
        `${steps.length} step(s) · status ${status} · evidence ${score}/100`,
      steps,
      supportingSources: sourcesForRoute(r),
      killCriteria: killCriteria(r, status, atlas),
      openQuestions: openQuestions(r, status),
      processRouteId: r.id,
      isTeaching: teaching,
    };
  });
}

/**
 * Scientific conflicts from atlas + multi-hypothesis routes + dossier contradictions.
 */
export function buildScientificConflicts(
  dossier: LiveDossier,
  atlas: ConditionAtlas,
  hypotheses: RouteHypothesis[]
): ScientificConflict[] {
  const out: ScientificConflict[] = [];
  let i = 0;

  for (const d of atlas.distributions) {
    if (!d.conflict) continue;
    out.push({
      id: `conf:cond:${d.kind}:${i++}`,
      topic: `Public ${d.kind} condition space`,
      kind: "condition",
      sideA: d.variants[0] || d.summary,
      sideB: d.variants[1] || d.conflictNote || "Conflicting sources",
      severity: "warning",
      resolvingExperiment: `Map ${d.kind} systematically under fixed other variables; public sources disagree (${d.conflictNote || "non-overlapping ranges"}).`,
      sourceHint: d.summary,
    });
  }

  const backed = hypotheses.filter((h) => h.status === "evidence-backed" || h.status === "partial");
  if (backed.length >= 2) {
    const a = backed[0]!;
    const b = backed[1]!;
    const aOps = a.steps.map((s) => s.unitOp || s.title).join(" → ");
    const bOps = b.steps.map((s) => s.unitOp || s.title).join(" → ");
    if (aOps && bOps && aOps !== bOps) {
      out.push({
        id: `conf:route:${i++}`,
        topic: "Competing public process sequences",
        kind: "route",
        sideA: `${a.name}: ${aOps.slice(0, 120)}`,
        sideB: `${b.name}: ${bOps.slice(0, 120)}`,
        severity: "warning",
        resolvingExperiment:
          "Compare key bond-forming / isolation steps against densified OA and patent examples; pick the sequence with grounded unit-ops, not narrative polish.",
      });
    }
  }

  for (const c of dossier.contradictions || []) {
    out.push({
      id: c.id || `conf:doss:${i++}`,
      topic: c.topic,
      kind: "other",
      sideA: c.sideA,
      sideB: c.sideB,
      severity: c.severity === "warning" ? "warning" : "info",
      resolvingExperiment:
        "Trace both sides to primary free-public documents; design a measurement that distinguishes the claims.",
      sourceHint: c.sourceHint,
    });
  }

  // Solvent split
  if (atlas.solvents.length >= 2 && atlas.solvents[0]!.n > 0 && atlas.solvents[1]!.n > 0) {
    const s0 = atlas.solvents[0]!;
    const s1 = atlas.solvents[1]!;
    if (s0.n >= 2 && s1.n >= 2) {
      out.push({
        id: `conf:solvent:${i++}`,
        topic: "Solvent cues in public text",
        kind: "condition",
        sideA: `${s0.name} (n=${s0.n})`,
        sideB: `${s1.name} (n=${s1.n})`,
        severity: "info",
        resolvingExperiment: `Public text mentions both ${s0.name} and ${s1.name}; compare conversion/impurity under controlled solvent screen (research experiment, not a plant limit).`,
      });
    }
  }

  return out.slice(0, 20);
}
