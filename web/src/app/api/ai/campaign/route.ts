/**
 * Server campaign science agent: densify CIDs (parallel) then answer over merged package.
 * Body: { cids, question, force?, concurrency?, useLlm?, model? }
 */

import { NextRequest, NextResponse } from "next/server";
import { mapPool } from "@/lib/dossier/parallelMap";
import { buildOneCidForBatch } from "@/lib/dossier/batchBuild";
import { mergeLiveDossiersToCampaignKnowledge } from "@/lib/frontier/campaignKnowledge";
import {
  answerCampaignQuestion,
  runCampaignAgentWithLlm,
} from "@/lib/frontier/campaignAgent";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  isAllowedOllamaHost,
  isLocalOllamaHost,
  OLLAMA_CLOUD_HOST,
} from "@/lib/ai/config";
import { getServerAiEnv, resolveRequestApiKey } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CIDS = 8;

export async function POST(req: NextRequest) {
  let body: {
    cids?: number[];
    question?: string;
    force?: boolean;
    concurrency?: number;
    name?: string;
    useLlm?: boolean;
    model?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cids = [
    ...new Set(
      (body.cids || [])
        .map(Number)
        .filter((c) => Number.isFinite(c) && c > 0 && c < 1e9)
    ),
  ].slice(0, MAX_CIDS);
  const question = (body.question || "").trim();
  if (!cids.length) {
    return NextResponse.json({ error: "cids required (1–8)" }, { status: 400 });
  }
  if (question.length < 4) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const concurrency = Math.min(4, Math.max(1, Number(body.concurrency) || 2));
  const force = Boolean(body.force);
  const wantLlm = Boolean(body.useLlm);
  const name = body.name?.trim() || `Campaign ${cids.join("+")}`;

  const dossiers: LiveDossier[] = [];
  const densifySteps: Array<{ cid: number; ok: boolean; error?: string }> = [];

  await mapPool(cids, concurrency, async (cid) => {
    try {
      const d = await buildOneCidForBatch(cid, { force });
      dossiers.push(d);
      densifySteps.push({ cid, ok: true });
    } catch (e) {
      densifySteps.push({
        cid,
        ok: false,
        error: e instanceof Error ? e.message : "fail",
      });
    }
    return null;
  });

  const merged = mergeLiveDossiersToCampaignKnowledge(dossiers, cids);
  const priorSteps = [
    {
      id: "s0",
      role: "densify" as const,
      detail: `Server densify ${densifySteps.filter((s) => s.ok).length}/${cids.length} · concurrency ${concurrency}${force ? " · force" : ""}`,
    },
    {
      id: "s1",
      role: "merge" as const,
      detail: merged.summary,
    },
  ];

  const meta = {
    campaignId: `server:${cids.join("-")}`,
    campaignName: name,
    requestedCount: cids.length,
  };

  let chat:
    | ((args: {
        system: string;
        user: string;
      }) => Promise<{
        ok: boolean;
        content?: string;
        model?: string;
        error?: string;
      }>)
    | undefined;

  if (wantLlm) {
    const env = getServerAiEnv();
    const host = (env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
    const local = isLocalOllamaHost(host);
    const { apiKey } = resolveRequestApiKey(req.headers.get("authorization"));
    if (isAllowedOllamaHost(host) && (local || apiKey)) {
      const model = (body.model || env.model).trim();
      chat = async ({ system, user }) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        const upstream = await fetch(`${host}/api/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            stream: false,
          }),
        });
        const text = await upstream.text();
        let data: { message?: { content?: string }; error?: string } = {};
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          return { ok: false, error: text.slice(0, 200) };
        }
        if (!upstream.ok) {
          return {
            ok: false,
            error: data.error || `HTTP ${upstream.status}`,
            model,
          };
        }
        return {
          ok: true,
          content: data.message?.content || "",
          model,
        };
      };
    }
  }

  const result =
    wantLlm && chat
      ? await runCampaignAgentWithLlm(merged, meta, question, chat, priorSteps)
      : answerCampaignQuestion(merged, meta, question, priorSteps);

  return NextResponse.json({
    ...result,
    densify: densifySteps,
    concurrency,
    force,
    note:
      wantLlm && !chat
        ? "LLM unavailable (key/host) — retrieval over densify package only"
        : wantLlm && chat && !result.usedLlm
          ? "LLM skipped or refused — retrieval used"
          : undefined,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/ai/campaign",
    body: {
      cids: [2244, 3672],
      question: "What temperature ranges appear across this campaign?",
      force: false,
      concurrency: 2,
      useLlm: false,
    },
    maxCids: MAX_CIDS,
    note: "Densifies free-public dossiers then answers over merged densify package (optional Ollama over campaign-ai-guidance). Not GMP.",
  });
}
