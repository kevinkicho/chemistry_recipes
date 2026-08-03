/**
 * Map weak ideal-page sections → harvest agent tools.
 * Closes live densify gaps without inventing plant numbers.
 */

import type { IdealSectionId, IdealSectionStatus } from "@/lib/dossier/idealPage";
import type { ApiToolCall } from "@/lib/frontier/apiAgentTools";

const WEAK_DEPTH = 45;

/** Which free-public recovery tools help which ideal section. */
const SECTION_TOOLS: Partial<
  Record<IdealSectionId, Array<ApiToolCall["tool"]>>
> = {
  "process-recipe": [
    "run_densify_pass",
    "retry_failed_families",
    "promote_annotations",
    "reextract_process_facts",
  ],
  "manufacturing-summary": [
    "run_densify_pass",
    "retry_failed_families",
    "reextract_process_facts",
  ],
  "critical-params": [
    "run_densify_pass",
    "reextract_process_facts",
  ],
  "related-entities": ["promote_annotations", "run_densify_pass"],
  apparatus: ["run_densify_pass", "reextract_process_facts"],
  environment: ["run_densify_pass"],
  ehs: ["reextract_process_facts"],
  overview: ["run_densify_pass", "reextract_process_facts"],
  applications: ["promote_annotations"],
  "route-compare": ["run_densify_pass", "retry_failed_families"],
  sources: ["retry_failed_families", "run_densify_pass"],
};

/** Process-critical families preferred when closing process-recipe gaps. */
const PROCESS_FAMILIES = [
  "europepmc",
  "pubmed",
  "openalex",
  "crossref",
  "patentsview",
  "europepmc-pat",
  "pubchem-patents",
  "orgsyn",
];

/**
 * Build an ordered, de-duplicated tool plan from weak ideal sections.
 */
export function planDensifyFromIdealWeaknesses(
  sections: Array<Pick<IdealSectionStatus, "id" | "depth" | "filled">>,
  opts?: { maxTools?: number }
): ApiToolCall[] {
  const maxTools = opts?.maxTools ?? 5;
  const weak = sections
    .filter((s) => !s.filled || s.depth < WEAK_DEPTH)
    .sort((a, b) => a.depth - b.depth);

  const seen = new Set<string>();
  const plan: ApiToolCall[] = [];

  const push = (call: ApiToolCall) => {
    const key = `${call.tool}:${(call.families || []).join(",")}`;
    if (seen.has(key)) return;
    // Allow same tool once (except we only push each tool once)
    if (seen.has(call.tool) && call.tool !== "retry_failed_families") return;
    seen.add(call.tool);
    seen.add(key);
    plan.push(call);
  };

  for (const s of weak) {
    if (plan.length >= maxTools) break;
    const tools = SECTION_TOOLS[s.id];
    if (!tools) continue;
    for (const tool of tools) {
      if (plan.length >= maxTools) break;
      if (tool === "retry_failed_families") {
        push({
          tool,
          families: PROCESS_FAMILIES,
          reason: `close ideal · ${s.id} (depth ${s.depth})`,
        });
      } else {
        push({
          tool,
          reason: `close ideal · ${s.id} (depth ${s.depth})`,
        });
      }
    }
  }

  // Always end recovery with facts + score when any densify ran
  if (plan.some((p) => p.tool === "run_densify_pass" || p.tool === "retry_failed_families" || p.tool === "promote_annotations")) {
    if (!seen.has("reextract_process_facts")) {
      push({
        tool: "reextract_process_facts",
        reason: "refresh atoms after ideal-close densify",
      });
    }
    if (!seen.has("score_evidence")) {
      push({
        tool: "score_evidence",
        reason: "rescore after ideal-close densify",
      });
    }
  }

  return plan.slice(0, maxTools + 2);
}

/**
 * Execute ideal-close tool plan against evidence (soft-fail tools).
 */
export async function executeIdealDensifyPlan(
  evidence: import("@/lib/dossier/types").CompoundEvidence,
  sections: Array<Pick<IdealSectionStatus, "id" | "depth" | "filled">>,
  opts?: {
    onStep?: (detail: string) => void;
  }
): Promise<{
  evidence: import("@/lib/dossier/types").CompoundEvidence;
  toolsRun: string[];
  plan: ApiToolCall[];
  summary: string;
}> {
  const { executeApiTool } = await import("@/lib/frontier/apiAgentTools");
  const plan = planDensifyFromIdealWeaknesses(sections);
  let current = evidence;
  const toolsRun: string[] = [];

  if (!plan.length) {
    return {
      evidence: current,
      toolsRun,
      plan,
      summary: "ideal sections already dense enough — no recovery tools",
    };
  }

  for (const call of plan) {
    opts?.onStep?.(
      `ideal-close · ${call.tool}${call.reason ? ` · ${call.reason}` : ""}`
    );
    const result = await executeApiTool(current, call);
    current = result.evidence;
    toolsRun.push(call.tool);
  }

  return {
    evidence: current,
    toolsRun,
    plan,
    summary: `ideal-close tools: ${toolsRun.join("→") || "none"}`,
  };
}

export function weakIdealSectionIds(
  sections: Array<Pick<IdealSectionStatus, "id" | "depth" | "filled">>
): IdealSectionId[] {
  return sections
    .filter((s) => !s.filled || s.depth < WEAK_DEPTH)
    .map((s) => s.id);
}
