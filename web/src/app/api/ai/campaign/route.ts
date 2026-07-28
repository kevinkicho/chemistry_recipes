/**
 * Server campaign science agent: densify CIDs (parallel) then answer over merged package.
 * Body: { cids: number[], question: string, force?: boolean, concurrency?: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { mapPool } from "@/lib/dossier/parallelMap";
import { buildOneCidForBatch } from "@/lib/dossier/batchBuild";
import { mergeLiveDossiersToCampaignKnowledge } from "@/lib/frontier/campaignKnowledge";
import { answerCampaignQuestion } from "@/lib/frontier/campaignAgent";
import type { LiveDossier } from "@/lib/dossier/types";

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
  const result = answerCampaignQuestion(
    merged,
    {
      campaignId: `server:${cids.join("-")}`,
      campaignName: name,
      requestedCount: cids.length,
    },
    question,
    [
      {
        id: "s0",
        role: "densify",
        detail: `Server densify ${densifySteps.filter((s) => s.ok).length}/${cids.length} · concurrency ${concurrency}${force ? " · force" : ""}`,
      },
      {
        id: "s1",
        role: "merge",
        detail: merged.summary,
      },
    ]
  );

  return NextResponse.json({
    ...result,
    densify: densifySteps,
    concurrency,
    force,
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
    },
    maxCids: MAX_CIDS,
    note: "Densifies free-public dossiers then answers over merged process-knowledge. Not GMP.",
  });
}
