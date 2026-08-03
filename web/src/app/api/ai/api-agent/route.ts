/**
 * Run free-public API harvest agent on a CID (or pre-gathered evidence path via densify).
 * Body: { cid, useLlm?, force? }
 */

import { NextRequest, NextResponse } from "next/server";
import { gatherCompoundEvidence } from "@/lib/dossier/gather";
import { runApiHarvestAgent } from "@/lib/frontier/apiAgent";
import { getServerAiEnv } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: {
    cid?: number;
    useLlm?: boolean;
    force?: boolean;
    /** If true, skip full gather and only re-agent an already-cached gather (force gather always) */
    reagentOnly?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cid = Number(body.cid);
  if (!Number.isFinite(cid) || cid <= 0) {
    return NextResponse.json({ error: "cid required" }, { status: 400 });
  }

  const env = getServerAiEnv();
  try {
    // Full gather already runs the agent at the end — this endpoint
    // re-runs agent for diagnostics or after force re-gather.
    const evidence = await gatherCompoundEvidence(cid, {
      force: body.force !== false,
    });

    // gather already ran agent; optional second pass for explicit API-agent probe
    if (body.reagentOnly) {
      const result = await runApiHarvestAgent(evidence, {
        useLlm: body.useLlm !== false && env.canCall,
      });
      return NextResponse.json({
        ...result,
        cid,
        moleculeName: result.evidence.identity?.name,
        aiCanCall: env.canCall,
      });
    }

    // Evidence already agent-orchestrated inside gather — report state
    const result = await runApiHarvestAgent(evidence, {
      useLlm: false, // report via local inspect/score only; avoid double densify cost
      maxSteps: 2,
    });

    return NextResponse.json({
      schema: "chemistry-recipes.api-agent.v1",
      cid,
      moleculeName: evidence.identity?.name,
      aiCanCall: env.canCall,
      note:
        "Primary harvest already ran api-agent inside gather. This response re-inspects state.",
      toolsRun: result.toolsRun,
      steps: result.steps,
      summary: result.summary,
      planner: result.planner,
      usedLlm: result.usedLlm,
      state: {
        procedureExcerpts: result.evidence.procedureExcerpts?.length || 0,
        literature: result.evidence.literature?.length || 0,
        patents: result.evidence.patents?.length || 0,
        softFails: (result.evidence.fetchErrors || []).filter((e) =>
          e.startsWith("soft-fail ·")
        ).length,
        agentNotes: (result.evidence.fetchErrors || []).filter((e) =>
          e.includes("api-agent")
        ),
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "API agent failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/ai/api-agent",
    body: {
      cid: 2244,
      useLlm: true,
      force: true,
      reagentOnly: false,
    },
    note: "Delegates densify/retry/status decisions to the harvest agent (LLM when configured, local tool planner otherwise).",
  });
}
