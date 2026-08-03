/**
 * Free-public API harvest agent — dynamic, reactive, compliance-aware.
 *
 * Observes harvest state, chooses tools, reacts to tool outcomes (replan),
 * and stops when dense/compliant or budget exhausted.
 *
 * Rails (never removed):
 * - Soft-fail tool execution
 * - Never invent plant numbers
 * - Bounded steps + wall clock
 * - Local planner when Ollama unavailable
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import { extractProcessFacts } from "@/lib/dossier/processFacts";
import { getServerAiEnv } from "@/lib/ai/serverEnv";
import {
  isAllowedOllamaHost,
  isLocalOllamaHost,
  OLLAMA_CLOUD_HOST,
} from "@/lib/ai/config";
import {
  API_TOOL_CATALOG,
  assessHarvestCompliance,
  executeApiTool,
  inspectHarvestState,
  type ApiToolCall,
  type ApiToolName,
  type ApiToolResult,
  type HarvestCompliance,
} from "@/lib/frontier/apiAgentTools";
import { needsDensifyPass } from "@/lib/dossier/densifyPass";
import { countSoftFailures } from "@/lib/dossier/gatherResilience";
import { failedFamiliesFromErrors } from "@/lib/dossier/densifyDelta";

export type ApiAgentStep = {
  id: string;
  role: "plan" | "tool" | "observe" | "react" | "stop" | "fallback" | "compliance";
  detail: string;
  tool?: ApiToolName;
  durationMs?: number;
  improved?: boolean;
};

export type HarvestAgentReport = {
  schema: "chemistry-recipes.api-agent.v1";
  planner: "llm" | "local";
  usedLlm: boolean;
  modelUsed?: string;
  toolsRun: ApiToolName[];
  steps: ApiAgentStep[];
  summary: string;
  compliance: HarvestCompliance;
  durationMs: number;
};

export type ApiAgentResult = HarvestAgentReport & {
  evidence: CompoundEvidence;
};

export type ApiAgentChatFn = (args: {
  system: string;
  user: string;
  model?: string;
}) => Promise<{ ok: boolean; content?: string; model?: string; error?: string }>;

export type ApiAgentProgressFn = (step: ApiAgentStep) => void;

const MAX_STEPS_BASE = 6;
const MAX_STEPS_THIN = 8;
const DEFAULT_BUDGET_MS = 95_000;

const PLANNER_SYSTEM = `You are the free-public API harvest agent for Chemistry Recipes.
Choose TOOL calls to densify free-public chemistry evidence. React to outcomes; do not thrash.
You do NOT invent plant setpoints, temperatures, yields, or CPPs.

Available tools:
${API_TOOL_CATALOG.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Return ONE JSON object (no markdown fences):
{
  "actions": [
    {"tool":"<name>","families":["optional"],"reason":"short why"}
  ],
  "done": false
}

Dynamic policy (API etiquette — do NOT thrash rate limits):
1. Prefer process-critical recovery: europepmc, pubmed, openalex, patents, orgsyn over clinical-only.
2. If rateLimitedHosts / rateLimitedFamilies present: NEVER retry those families immediately. Either wait_for_rate_limits (once, short) OR densify/promote alternate free-public sources.
3. If openCircuits listed, avoid retrying those hosts; densify other sources instead.
4. On HTTP 429 history (Semantic Scholar, PubMed, etc.): skip that host; use Europe PMC / OpenAlex / patents instead.
5. If procedure thin but annotations present → promote_annotations before or after densify.
6. If complianceGrade is thin → prioritize densify/promote over hammering failed hosts.
7. After a tool that improved=false twice, switch strategy (densify↔retry↔promote) or stop — never tight-loop one 429 host.
8. stop when complianceGrade pass/soft AND not needsDensify, or budget exhausted.
9. Max 3 actions per turn. Prefer fewer high-value tools.
10. Educational free-public densify only — not GMP.`;

function extractJsonObject(text: string): unknown | null {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function parsePlan(content: string): ApiToolCall[] {
  const raw = extractJsonObject(content);
  if (!raw || typeof raw !== "object") return [];
  const o = raw as { actions?: unknown; done?: boolean };
  if (o.done === true && (!Array.isArray(o.actions) || o.actions.length === 0)) {
    return [{ tool: "stop", reason: "planner done" }];
  }
  if (!Array.isArray(o.actions)) return [];
  const out: ApiToolCall[] = [];
  for (const a of o.actions) {
    if (!a || typeof a !== "object") continue;
    const tool = (a as { tool?: string }).tool;
    if (!tool || !API_TOOL_CATALOG.some((t) => t.name === tool)) continue;
    const families = (a as { families?: unknown }).families;
    out.push({
      tool: tool as ApiToolName,
      reason:
        typeof (a as { reason?: string }).reason === "string"
          ? (a as { reason: string }).reason
          : undefined,
      families: Array.isArray(families)
        ? families.filter((x): x is string => typeof x === "string").slice(0, 12)
        : undefined,
    });
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Local reactive planner — one tool at a time based on latest state + last outcome.
 */
export function planLocalHarvestActions(
  state: Record<string, unknown>,
  already: Set<ApiToolName>,
  opts?: {
    lastTool?: ApiToolName;
    lastImproved?: boolean;
    stagnant?: number;
  }
): ApiToolCall[] {
  const softFails = Number(state.softFails || 0);
  const needsDensify = Boolean(state.needsDensify);
  const failed = Array.isArray(state.failedFamilies)
    ? (state.failedFamilies as string[])
    : [];
  const excerpts = Number(state.procedureExcerpts || 0);
  const procChars = Number(state.procedureChars || 0);
  const annotations = Number(state.annotations || 0);
  const complianceGrade = String(state.complianceGrade || "thin");
  const openCircuits = Array.isArray(state.openCircuits)
    ? (state.openCircuits as string[])
    : [];
  const thin = needsDensify || excerpts < 3 || procChars < 1200;
  const stagnant = opts?.stagnant || 0;

  if (!already.has("inspect_state")) {
    return [{ tool: "inspect_state", reason: "baseline harvest observation" }];
  }

  // After stagnant tools, try a different strategy or stop
  if (stagnant >= 2 && already.has("run_densify_pass") && already.has("retry_failed_families")) {
    if (!already.has("promote_annotations") && annotations > 0) {
      return [
        {
          tool: "promote_annotations",
          reason: "stagnant densify/retry — promote annotations",
        },
      ];
    }
    if (!already.has("compliance_check")) {
      return [{ tool: "compliance_check", reason: "stagnant — compliance snapshot" }];
    }
    if (!already.has("score_evidence")) {
      return [{ tool: "score_evidence", reason: "stagnant — final score" }];
    }
    return [{ tool: "stop", reason: "stagnant recovery — stop" }];
  }

  const rateLimitedHosts = Array.isArray(state.rateLimitedHosts)
    ? (state.rateLimitedHosts as string[])
    : [];
  const rateLimitedFamilies = Array.isArray(state.rateLimitedFamilies)
    ? (state.rateLimitedFamilies as string[])
    : [];

  // Rate-limit etiquette: never thrash 429 hosts — wait once or densify alternate sources
  if (
    rateLimitedHosts.length > 0 &&
    !already.has("list_rate_limits") &&
    !already.has("wait_for_rate_limits")
  ) {
    return [
      {
        tool: "list_rate_limits",
        reason: "observe 429 cooldowns before any retry",
      },
    ];
  }
  if (
    rateLimitedFamilies.length > 0 &&
    thin &&
    !already.has("run_densify_pass") &&
    already.has("list_rate_limits")
  ) {
    return [
      {
        tool: "run_densify_pass",
        reason: "rate-limited families present — densify alternate free-public sources (no thrash)",
      },
    ];
  }
  if (
    rateLimitedHosts.length > 0 &&
    already.has("run_densify_pass") &&
    !already.has("wait_for_rate_limits") &&
    thin &&
    failed.some((f) => rateLimitedFamilies.includes(f))
  ) {
    return [
      {
        tool: "wait_for_rate_limits",
        maxWaitMs: 12_000,
        reason: "one polite wait then optional retry of cooled hosts",
      },
    ];
  }

  // Prefer process-critical retries; avoid open circuits AND rate-limited hosts
  if (
    thin &&
    (softFails >= 2 || failed.length >= 1) &&
    !already.has("retry_failed_families")
  ) {
    const prefer = failed.filter((f) =>
      /europepmc|pubmed|openalex|crossref|patent|pubchem|orgsyn/i.test(f)
    );
    const avoidHosts = [
      ...openCircuits.map((h) => h.split(".")[0] || h),
      ...rateLimitedHosts.map((h) => h.split(".")[0] || h),
    ];
    const filtered = prefer.filter(
      (f) =>
        !rateLimitedFamilies.includes(f) &&
        !avoidHosts.some((h) => f.toLowerCase().includes(h.toLowerCase()))
    );
    if (!filtered.length && prefer.length && rateLimitedFamilies.length) {
      // All process-critical fails are rate-limited → densify instead of thrash
      if (!already.has("run_densify_pass")) {
        return [
          {
            tool: "run_densify_pass",
            reason: "all critical retries rate-limited — densify without thrash",
          },
        ];
      }
    }
    return [
      {
        tool: "retry_failed_families",
        families: (filtered.length ? filtered : prefer).slice(0, 8) || undefined,
        reason:
          rateLimitedHosts.length || openCircuits.length
            ? "retry soft-fails (etiquette: skip rate-limited/circuit hosts)"
            : "recover soft-failed free-public families",
      },
    ];
  }

  if (thin && !already.has("run_densify_pass")) {
    return [
      {
        tool: "run_densify_pass",
        reason: "procedure text thin — densify OA/patents",
      },
    ];
  }

  if (
    thin &&
    annotations > 0 &&
    !already.has("promote_annotations") &&
    (already.has("run_densify_pass") || excerpts < 2)
  ) {
    return [
      {
        tool: "promote_annotations",
        reason: "lift annotations into procedure windows",
      },
    ];
  }

  if (
    (already.has("run_densify_pass") ||
      already.has("retry_failed_families") ||
      already.has("promote_annotations")) &&
    !already.has("reextract_process_facts")
  ) {
    return [
      {
        tool: "reextract_process_facts",
        reason: "refresh atoms after densify/retry/promote",
      },
    ];
  }

  if (
    (complianceGrade === "thin" || complianceGrade === "soft") &&
    !already.has("compliance_check")
  ) {
    return [{ tool: "compliance_check", reason: "free-public compliance gate" }];
  }

  if (!already.has("score_evidence")) {
    return [{ tool: "score_evidence", reason: "final score for dual-view gate" }];
  }

  return [{ tool: "stop", reason: "local policy complete" }];
}

async function defaultChat(
  system: string,
  user: string,
  model?: string
): Promise<{ ok: boolean; content?: string; model?: string; error?: string }> {
  const env = getServerAiEnv();
  if (!env.canCall) {
    return { ok: false, error: "Ollama not configured" };
  }
  const host = (env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
  if (!isAllowedOllamaHost(host)) {
    return { ok: false, error: "Host not allowed" };
  }
  const local = isLocalOllamaHost(host);
  if (!local && !env.apiKey) {
    return { ok: false, error: "No API key" };
  }
  const useModel = (model || env.fastModel || env.model).trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22_000);
  try {
    const upstream = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });
    const text = await upstream.text();
    let data: { message?: { content?: string }; error?: string } = {};
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      return { ok: false, error: text.slice(0, 200), model: useModel };
    }
    if (!upstream.ok) {
      return {
        ok: false,
        error: data.error || `HTTP ${upstream.status}`,
        model: useModel,
      };
    }
    return {
      ok: true,
      content: data.message?.content || "",
      model: useModel,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "chat failed",
      model: useModel,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run the API harvest agent over post-gather evidence.
 * Reactive loop: plan → tool → observe delta → replan.
 */
export async function runApiHarvestAgent(
  evidence: CompoundEvidence,
  opts?: {
    chat?: ApiAgentChatFn;
    useLlm?: boolean;
    maxSteps?: number;
    budgetMs?: number;
    model?: string;
    onStep?: ApiAgentProgressFn;
  }
): Promise<ApiAgentResult> {
  const tStart = Date.now();
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS;
  const steps: ApiAgentStep[] = [];
  const toolsRun: ApiToolName[] = [];
  const already = new Set<ApiToolName>();
  let current = evidence;
  let usedLlm = false;
  let modelUsed: string | undefined;
  let planner: "llm" | "local" = "local";
  let stagnant = 0;
  let lastTool: ApiToolName | undefined;
  let lastImproved = false;

  const push = (step: ApiAgentStep) => {
    steps.push(step);
    opts?.onStep?.(step);
  };

  const wantLlm = opts?.useLlm !== false;

  // Inspect baseline
  {
    const t0 = Date.now();
    const inspect = await executeApiTool(current, { tool: "inspect_state" });
    current = inspect.evidence;
    already.add("inspect_state");
    toolsRun.push("inspect_state");
    push({
      id: "inspect",
      role: "observe",
      tool: "inspect_state",
      detail: inspect.detail,
      durationMs: Date.now() - t0,
    });
  }

  let state = inspectHarvestState(current);
  const thinStart =
    Boolean(state.needsDensify) ||
    Number(state.procedureExcerpts || 0) < 3 ||
    Number(state.procedureChars || 0) < 1200;
  const maxSteps =
    opts?.maxSteps ?? (thinStart ? MAX_STEPS_THIN : MAX_STEPS_BASE);

  // Early exit: dense + compliant
  const earlyDense =
    !needsDensifyPass(current) &&
    countSoftFailures(current.fetchErrors) < 2 &&
    failedFamiliesFromErrors(current.fetchErrors || []).length === 0 &&
    (current.procedureExcerpts?.length || 0) >= 4 &&
    String(state.complianceGrade) !== "thin";

  if (earlyDense) {
    const scored = await executeApiTool(current, { tool: "score_evidence" });
    current = scored.evidence;
    toolsRun.push("score_evidence");
    const compliance = assessHarvestCompliance(current);
    push({
      id: "early-stop",
      role: "stop",
      tool: "stop",
      detail: `already dense · compliance ${compliance.grade} · ${scored.detail}`,
    });
    current = {
      ...current,
      processFacts: current.processFacts ?? extractProcessFacts(current),
      fetchErrors: [
        ...(current.fetchErrors || []),
        "api-agent · skip · harvest already dense",
      ].slice(0, 80),
      harvestAgent: undefined,
    };
    const durationMs = Date.now() - tStart;
    const report: HarvestAgentReport = {
      schema: "chemistry-recipes.api-agent.v1",
      planner: "local",
      usedLlm: false,
      toolsRun,
      steps,
      summary: `Skipped agent loop — dense · compliance ${compliance.grade} ${compliance.score}`,
      compliance,
      durationMs,
    };
    current = { ...current, harvestAgent: report };
    return { ...report, evidence: current };
  }

  for (let i = 0; i < maxSteps; i++) {
    if (Date.now() - tStart > budgetMs) {
      push({
        id: `budget-${i}`,
        role: "stop",
        detail: `budget ${budgetMs}ms exhausted`,
      });
      break;
    }

    state = inspectHarvestState(current);
    let actions: ApiToolCall[] = [];

    if (wantLlm) {
      const user =
        `Harvest state (JSON):\n${JSON.stringify(state).slice(0, 6500)}\n\n` +
        `Tools already run: ${[...already].join(", ") || "(none)"}\n` +
        `Last tool: ${lastTool || "none"} improved=${lastImproved} stagnant=${stagnant}\n` +
        `Return next actions JSON (react to outcomes).`;
      const tPlan = Date.now();
      const chatFn =
        opts?.chat ||
        ((args: { system: string; user: string; model?: string }) =>
          defaultChat(args.system, args.user, args.model || opts?.model));
      const res = await chatFn({
        system: PLANNER_SYSTEM,
        user,
        model: opts?.model,
      });
      if (res.ok && res.content) {
        actions = parsePlan(res.content);
        if (actions.length) {
          usedLlm = true;
          planner = "llm";
          modelUsed = res.model || modelUsed;
          push({
            id: `plan-llm-${i}`,
            role: "plan",
            detail: `LLM plan · ${actions.map((a) => a.tool).join(" → ")}`,
            durationMs: Date.now() - tPlan,
          });
        } else {
          push({
            id: `plan-llm-empty-${i}`,
            role: "fallback",
            detail: "LLM plan empty — local reactive planner",
            durationMs: Date.now() - tPlan,
          });
        }
      } else if (i === 0) {
        push({
          id: "plan-llm-unavailable",
          role: "fallback",
          detail: res.error || "LLM unavailable — local planner",
          durationMs: Date.now() - tPlan,
        });
      }
    }

    if (!actions.length) {
      actions = planLocalHarvestActions(state, already, {
        lastTool,
        lastImproved,
        stagnant,
      });
      push({
        id: `plan-local-${i}`,
        role: "plan",
        detail: `local reactive plan · ${actions.map((a) => a.tool).join(" → ")}`,
      });
    }

    let stopped = false;
    for (const call of actions) {
      if (call.tool === "stop") {
        push({
          id: `stop-${i}`,
          role: "stop",
          tool: "stop",
          detail: call.reason || "stop",
        });
        stopped = true;
        break;
      }
      if (already.has(call.tool) && call.tool !== "inspect_state") {
        continue;
      }

      const t0 = Date.now();
      const result: ApiToolResult = await executeApiTool(current, call);
      current = result.evidence;
      already.add(call.tool);
      toolsRun.push(call.tool);
      lastTool = call.tool;
      lastImproved = Boolean(result.improved);
      if (result.improved) stagnant = 0;
      else if (call.tool !== "inspect_state" && call.tool !== "compliance_check" && call.tool !== "score_evidence")
        stagnant += 1;

      push({
        id: `tool-${call.tool}-${i}`,
        role: "tool",
        tool: call.tool,
        detail: result.detail + (call.reason ? ` · ${call.reason}` : ""),
        durationMs: Date.now() - t0,
        improved: result.improved,
      });

      // Reactive observation after each tool
      if (result.improved !== undefined) {
        push({
          id: `react-${call.tool}-${i}`,
          role: "react",
          tool: call.tool,
          detail: result.improved
            ? `improved · continue densify path`
            : `no gain · stagnant=${stagnant} · replan`,
          improved: result.improved,
        });
      }
    }
    if (stopped) break;

    // Compliance stop: soft/pass and not thin
    state = inspectHarvestState(current);
    if (
      (state.complianceGrade === "pass" || state.complianceGrade === "soft") &&
      !state.needsDensify &&
      already.has("score_evidence")
    ) {
      push({
        id: `compliant-stop-${i}`,
        role: "stop",
        detail: `compliance ${state.complianceGrade} · densify not needed`,
      });
      break;
    }

    const more = planLocalHarvestActions(state, already, {
      lastTool,
      lastImproved,
      stagnant,
    });
    if (more.length === 1 && more[0].tool === "stop") break;
    if (more.every((a) => already.has(a.tool) || a.tool === "stop")) break;
  }

  // Final compliance + facts
  if (!already.has("compliance_check")) {
    const c = await executeApiTool(current, { tool: "compliance_check" });
    current = c.evidence;
    toolsRun.push("compliance_check");
    push({
      id: "final-compliance",
      role: "compliance",
      tool: "compliance_check",
      detail: c.detail,
    });
  }

  const compliance = assessHarvestCompliance(current);
  const durationMs = Date.now() - tStart;
  current = {
    ...current,
    processFacts: extractProcessFacts(current),
    fetchErrors: [
      ...(current.fetchErrors || []),
      `api-agent · ${planner} · tools: ${toolsRun.join(" → ") || "none"} · compliance ${compliance.grade} ${compliance.score} · ${durationMs}ms`,
    ].slice(0, 80),
  };

  const finalState = inspectHarvestState(current);
  const summary = [
    `API harvest agent (${planner}${usedLlm ? "+llm" : ""})`,
    `compliance ${compliance.grade} ${compliance.score}`,
    `score ${finalState.evidenceScore}`,
    `proc ${finalState.procedureChars} chars`,
    `${finalState.procedureExcerpts} excerpts`,
    `softFails ${finalState.softFails}`,
    toolsRun.length ? `tools ${toolsRun.join("→")}` : "no tools",
  ].join(" · ");

  push({
    id: "complete",
    role: "stop",
    detail: summary,
    durationMs,
  });

  const report: HarvestAgentReport = {
    schema: "chemistry-recipes.api-agent.v1",
    planner,
    usedLlm,
    modelUsed,
    toolsRun,
    steps,
    summary,
    compliance,
    durationMs,
  };
  current = { ...current, harvestAgent: report };

  return { ...report, evidence: current };
}
