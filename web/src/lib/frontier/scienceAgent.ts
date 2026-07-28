/**
 * Quote-bound scientific agent loop (server or client).
 * Multi-step: retrieve → optional densify neighbors → optional Ollama with package-only context.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessKnowledgePackage, EvidenceAnswer } from "@/lib/frontier/types";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import { answerFromEvidencePackage } from "@/lib/frontier/evidenceQa";

export interface ScienceAgentStep {
  id: string;
  role: "retrieve" | "reason" | "refuse" | "cite" | "densify" | "merge";
  detail: string;
  durationMs?: number;
  cid?: number;
}

export interface ScienceAgentResult {
  question: string;
  answer: EvidenceAnswer;
  steps: ScienceAgentStep[];
  modelUsed?: string;
  usedLlm: boolean;
  packageMetrics: ProcessKnowledgePackage["metrics"];
  /** Neighbor packages densified during this run */
  neighborCids?: number[];
}

function packageContext(pack: ProcessKnowledgePackage): string {
  const lines: string[] = [
    `CID ${pack.cid} ${pack.moleculeName || ""}`,
    pack.conditionAtlas.summary,
    ...pack.conditionAtlas.distributions.map((d) => d.summary),
    ...pack.routeHypotheses.slice(0, 4).map(
      (h) =>
        `Hypothesis ${h.name} [${h.status}]: ${h.summary}\nKill: ${h.killCriteria.join("; ")}`
    ),
    ...pack.conflicts.slice(0, 6).map((c) => `Conflict ${c.topic}: ${c.sideA} VS ${c.sideB}`),
    ...pack.nextExperiments.slice(0, 4).map((e) => `Experiment: ${e.question}`),
    ...pack.seedAnswers.map((a) => `Q: ${a.question}\nA: ${a.answer}`),
  ];
  if (pack.reactionNetwork) {
    lines.push(
      `Network: ${pack.reactionNetwork.summary}`,
      `Campaign CIDs: ${pack.reactionNetwork.campaignCids.join(", ")}`
    );
  }
  for (const d of pack.conditionAtlas.distributions) {
    for (const o of d.observations.slice(0, 3)) {
      lines.push(`QUOTE [${o.sourceLabel}]: ${o.quote}`);
    }
  }
  return lines.join("\n").slice(0, 28_000);
}

function mergeNeighborContext(
  primary: ProcessKnowledgePackage,
  neighbors: ProcessKnowledgePackage[]
): string {
  const parts = [packageContext(primary)];
  for (const n of neighbors) {
    parts.push(
      `\n--- NEIGHBOR CID ${n.cid} ${n.moleculeName || ""} ---`,
      n.conditionAtlas.summary,
      ...n.routeHypotheses.slice(0, 2).map((h) => h.summary),
      ...n.conditionAtlas.distributions.slice(0, 3).flatMap((d) =>
        d.observations.slice(0, 2).map((o) => `QUOTE [${o.sourceLabel}]: ${o.quote}`)
      )
    );
  }
  return parts.join("\n").slice(0, 40_000);
}

const AGENT_SYSTEM = `You are a process-chemistry research assistant for free-public evidence only.
RULES:
1. Answer ONLY using the EVIDENCE PACKAGE below. If the package does not support an answer, say "Insufficient free-public evidence."
2. NEVER invent temperatures, yields, equipment IDs, plant CPPs, or stoichiometry not present in the package.
3. Prefer short answers with explicit citations as source labels already in the package.
4. Suggest experiments as research questions, not site setpoints.
5. Neighbor CID sections are free-public densify of related molecules — not the same compound.
6. Not GMP advice. Not legal/IP advice.`;

/**
 * Suggest neighbor CIDs to densify from network (exclude center).
 */
export function suggestNeighborCids(
  pack: ProcessKnowledgePackage,
  max = 3
): number[] {
  const center = pack.cid;
  const fromNet = (pack.reactionNetwork?.campaignCids || []).filter(
    (c) => c > 0 && c !== center
  );
  return [...new Set(fromNet)].slice(0, max);
}

/**
 * Deterministic multi-step agent (no LLM): retrieve → structure answer.
 */
export function runScienceAgentLocal(
  question: string,
  dossier: LiveDossier,
  pack?: ProcessKnowledgePackage
): ScienceAgentResult {
  const t0 = Date.now();
  const knowledge = pack || buildProcessKnowledgePackage(dossier);
  const steps: ScienceAgentStep[] = [
    {
      id: "s1",
      role: "retrieve",
      detail: `Loaded process-knowledge.v1 · ${knowledge.metrics.observationCount} obs · ${knowledge.metrics.hypothesisCount} hypotheses`,
      durationMs: Date.now() - t0,
    },
  ];
  const t1 = Date.now();
  const answer = answerFromEvidencePackage(
    question,
    dossier,
    knowledge.conditionAtlas,
    knowledge.routeHypotheses
  );
  steps.push({
    id: "s2",
    role: answer.insufficientEvidence ? "refuse" : "cite",
    detail: answer.insufficientEvidence
      ? "Insufficient package support — refused to invent"
      : `Grounded retrieval with ${answer.citations.length} citation(s)`,
    durationMs: Date.now() - t1,
  });
  return {
    question,
    answer,
    steps,
    usedLlm: false,
    packageMetrics: knowledge.metrics,
  };
}

export type ChatFn = (args: {
  system: string;
  user: string;
  model?: string;
}) => Promise<{ ok: boolean; content?: string; model?: string; error?: string }>;

export type DensifyCidFn = (cid: number) => Promise<LiveDossier | null>;

/**
 * Agent with optional densify-neighbor tool then optional LLM.
 * densifyCid should run free-public pipeline for a neighbor CID.
 */
export async function runScienceAgentWithTools(
  question: string,
  dossier: LiveDossier,
  opts?: {
    pack?: ProcessKnowledgePackage;
    densifyCid?: DensifyCidFn;
    densifyNeighbors?: boolean;
    maxNeighbors?: number;
    chat?: ChatFn;
    useLlm?: boolean;
  }
): Promise<ScienceAgentResult> {
  const knowledge = opts?.pack || buildProcessKnowledgePackage(dossier);
  const steps: ScienceAgentStep[] = [];
  const t0 = Date.now();
  steps.push({
    id: "s1",
    role: "retrieve",
    detail: `Primary package CID ${knowledge.cid} · ${knowledge.metrics.observationCount} obs`,
    durationMs: Date.now() - t0,
  });

  const neighborPacks: ProcessKnowledgePackage[] = [];
  const neighborCids: number[] = [];

  const wantNeighbors =
    opts?.densifyNeighbors ||
    /neighbor|related|impurit|starting.?material|intermediate|network|compare.*cid/i.test(
      question
    );

  if (wantNeighbors && opts?.densifyCid) {
    const targets = suggestNeighborCids(knowledge, opts.maxNeighbors ?? 2);
    for (const ncid of targets) {
      const tD = Date.now();
      steps.push({
        id: `densify-${ncid}`,
        role: "densify",
        detail: `Densifying neighbor CID ${ncid}…`,
        cid: ncid,
      });
      try {
        const nd = await opts.densifyCid(ncid);
        if (nd) {
          const np = nd.processKnowledge || buildProcessKnowledgePackage(nd);
          neighborPacks.push(np);
          neighborCids.push(ncid);
          steps.push({
            id: `densify-ok-${ncid}`,
            role: "densify",
            detail: `Neighbor CID ${ncid} densified · ${np.metrics.observationCount} obs · ${np.metrics.procedureChars} proc chars`,
            cid: ncid,
            durationMs: Date.now() - tD,
          });
        } else {
          steps.push({
            id: `densify-fail-${ncid}`,
            role: "densify",
            detail: `Neighbor CID ${ncid} densify returned empty`,
            cid: ncid,
            durationMs: Date.now() - tD,
          });
        }
      } catch (e) {
        steps.push({
          id: `densify-err-${ncid}`,
          role: "densify",
          detail: `Neighbor CID ${ncid}: ${e instanceof Error ? e.message : "fail"}`,
          cid: ncid,
          durationMs: Date.now() - tD,
        });
      }
    }
    if (neighborPacks.length) {
      steps.push({
        id: "merge",
        role: "merge",
        detail: `Merged ${neighborPacks.length} neighbor package(s) into agent context`,
      });
    }
  }

  // Primary retrieval
  const t1 = Date.now();
  let answer = answerFromEvidencePackage(
    question,
    dossier,
    knowledge.conditionAtlas,
    knowledge.routeHypotheses
  );

  // If insufficient and we have neighbors, try keyword hit on neighbor quotes
  if (answer.insufficientEvidence && neighborPacks.length) {
    const quotes: string[] = [];
    for (const np of neighborPacks) {
      for (const d of np.conditionAtlas.distributions) {
        for (const o of d.observations.slice(0, 3)) {
          quotes.push(
            `[CID ${np.cid} ${np.moleculeName || ""}] ${o.raw}: “${o.quote.slice(0, 120)}” (${o.sourceLabel})`
          );
        }
      }
    }
    if (quotes.length) {
      answer = {
        id: `agent-neighbor:${Date.now()}`,
        question,
        answer: `Primary package was thin. Neighbor free-public densify yielded:\n${quotes.slice(0, 8).join("\n")}\n\nStill not plant setpoints — open primary sources.`,
        grounded: true,
        citations: neighborPacks.flatMap((np) =>
          np.conditionAtlas.distributions.flatMap((d) =>
            d.observations.slice(0, 1).map((o) => ({
              label: `CID ${np.cid}: ${o.sourceLabel}`,
              url: o.sourceUrl,
              quote: o.quote.slice(0, 160),
            }))
          )
        ).slice(0, 8),
        insufficientEvidence: false,
      };
      steps.push({
        id: "s2-neighbor",
        role: "cite",
        detail: "Answer supplemented from densified neighbor packages",
        durationMs: Date.now() - t1,
      });
    } else {
      steps.push({
        id: "s2",
        role: "refuse",
        detail: "Insufficient package + neighbor support",
        durationMs: Date.now() - t1,
      });
    }
  } else {
    steps.push({
      id: "s2",
      role: answer.insufficientEvidence ? "refuse" : "cite",
      detail: answer.insufficientEvidence
        ? "Insufficient package support — refused to invent"
        : `Grounded retrieval with ${answer.citations.length} citation(s)`,
      durationMs: Date.now() - t1,
    });
  }

  if (!opts?.useLlm || !opts.chat) {
    return {
      question,
      answer,
      steps,
      usedLlm: false,
      packageMetrics: knowledge.metrics,
      neighborCids,
    };
  }

  // Thin package skip LLM
  if (
    answer.insufficientEvidence &&
    knowledge.metrics.observationCount < 2 &&
    neighborPacks.length === 0
  ) {
    steps.push({
      id: "s3",
      role: "refuse",
      detail: "Skipped LLM — package too thin to ground a model call",
    });
    return {
      question,
      answer,
      steps,
      usedLlm: false,
      packageMetrics: knowledge.metrics,
      neighborCids,
    };
  }

  const tL = Date.now();
  const ctx = mergeNeighborContext(knowledge, neighborPacks);
  const user = `EVIDENCE PACKAGE (free-public only):\n${ctx}\n\nSCIENTIST QUESTION:\n${question}\n\nRespond with: (1) answer or insufficient evidence (2) which package facts you used.`;

  try {
    const res = await opts.chat({ system: AGENT_SYSTEM, user });
    if (!res.ok || !res.content?.trim()) {
      steps.push({
        id: "s3",
        role: "reason",
        detail: `LLM unavailable: ${res.error || "empty"} — using retrieval only`,
        durationMs: Date.now() - tL,
      });
      return {
        question,
        answer,
        steps,
        usedLlm: false,
        packageMetrics: knowledge.metrics,
        neighborCids,
      };
    }
    const content = res.content.trim();
    const modelRefuses =
      /insufficient free-public evidence|not (present|supported) in the (package|evidence)/i.test(
        content
      );
    steps.push({
      id: "s3",
      role: modelRefuses ? "refuse" : "reason",
      detail: `LLM over package (+${neighborPacks.length} neighbors) · ${res.model || "model"}`,
      durationMs: Date.now() - tL,
    });
    return {
      question,
      answer: {
        id: `agent:${Date.now()}`,
        question,
        answer: content.slice(0, 4000),
        grounded: !modelRefuses && (answer.citations.length > 0 || neighborPacks.length > 0),
        citations: answer.citations,
        insufficientEvidence: modelRefuses,
      },
      steps,
      modelUsed: res.model,
      usedLlm: true,
      packageMetrics: knowledge.metrics,
      neighborCids,
    };
  } catch (e) {
    steps.push({
      id: "s3",
      role: "reason",
      detail: `LLM error: ${e instanceof Error ? e.message : "fail"}`,
      durationMs: Date.now() - tL,
    });
    return {
      question,
      answer,
      steps,
      usedLlm: false,
      packageMetrics: knowledge.metrics,
      neighborCids,
    };
  }
}

/** @deprecated prefer runScienceAgentWithTools */
export async function runScienceAgentWithLlm(
  question: string,
  dossier: LiveDossier,
  chat: ChatFn,
  pack?: ProcessKnowledgePackage
): Promise<ScienceAgentResult> {
  return runScienceAgentWithTools(question, dossier, {
    pack,
    chat,
    useLlm: true,
  });
}

export { AGENT_SYSTEM, packageContext };
