/**
 * Batch densify / warm live dossiers for multiple PubChem CIDs.
 * Parallel builds with concurrency cap + per-CID transient retries. Max 12 CIDs.
 */

import { NextRequest, NextResponse } from "next/server";
import type { LiveDossier } from "@/lib/dossier/types";
import { mapPool, isTransientError } from "@/lib/dossier/parallelMap";
import {
  buildOneCidForBatch,
  slimDossierSummary,
} from "@/lib/dossier/batchBuild";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CIDS = 12;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 4;

export interface BatchDossierResult {
  cid: number;
  ok: boolean;
  error?: string;
  durationMs: number;
  attempts?: number;
  summary?: ReturnType<typeof slimDossierSummary>;
  dossier?: LiveDossier;
}

async function buildCidResult(
  cid: number,
  opts: {
    model?: string;
    fastModel?: string;
    includeDossiers?: boolean;
    retries: number;
    force?: boolean;
  }
): Promise<BatchDossierResult> {
  const t0 = Date.now();
  let lastErr: unknown;
  const maxAttempts = opts.retries + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const dossier = await buildOneCidForBatch(cid, {
        model: opts.model,
        fastModel: opts.fastModel,
        force: opts.force,
      });
      return {
        cid,
        ok: true,
        durationMs: Date.now() - t0,
        attempts: attempt,
        summary: slimDossierSummary(dossier),
        dossier: opts.includeDossiers ? dossier : undefined,
      };
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts || !isTransientError(e)) break;
      const delay = 400 * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return {
    cid,
    ok: false,
    error: lastErr instanceof Error ? lastErr.message : "Build failed",
    durationMs: Date.now() - t0,
    attempts: maxAttempts,
  };
}

export async function POST(req: NextRequest) {
  let body: {
    cids?: number[];
    force?: boolean;
    includeDossiers?: boolean;
    model?: string;
    fastModel?: string;
    concurrency?: number;
    retries?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = Array.isArray(body.cids) ? body.cids : [];
  const cids = [
    ...new Set(
      raw
        .map((c) => Number(c))
        .filter((c) => Number.isFinite(c) && c > 0 && c < 1e9)
    ),
  ].slice(0, MAX_CIDS);

  if (!cids.length) {
    return NextResponse.json(
      { error: "Body must include cids: number[] (1–12 PubChem CIDs)" },
      { status: 400 }
    );
  }

  const safeModel = (m?: string) =>
    m && /^[a-zA-Z0-9_.:/-]{1,128}$/.test(m) ? m : undefined;
  const model = safeModel(body.model);
  const fastModel = safeModel(body.fastModel);
  const includeDossiers = Boolean(body.includeDossiers);
  const force = Boolean(body.force);
  // Number(undefined) is NaN — do not use `??` after Number() or the retry loop never runs
  const concurrencyRaw = Number(body.concurrency);
  const concurrency = Math.min(
    MAX_CONCURRENCY,
    Math.max(
      1,
      Number.isFinite(concurrencyRaw) ? concurrencyRaw : DEFAULT_CONCURRENCY
    )
  );
  const retriesRaw = Number(body.retries);
  const retries = Math.min(
    3,
    Math.max(0, Number.isFinite(retriesRaw) ? retriesRaw : 2)
  );

  const started = Date.now();
  const results = await mapPool(cids, concurrency, (cid) =>
    buildCidResult(cid, {
      model,
      fastModel,
      includeDossiers,
      retries,
      force,
    })
  );

  return NextResponse.json({
    schema: "chemistry-recipes.batch-dossier.v1",
    requested: cids.length,
    ok: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    durationMs: Date.now() - started,
    concurrency,
    retries,
    results,
    disclaimer:
      "Batch free-public densify only. Not GMP. Parallel builds with concurrency cap + transient retries.",
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/dossier/batch",
    body: {
      cids: [2244, 3672],
      includeDossiers: false,
      concurrency: 2,
      retries: 2,
      model: "optional",
      fastModel: "optional",
    },
    maxCids: MAX_CIDS,
    maxConcurrency: MAX_CONCURRENCY,
    defaultConcurrency: DEFAULT_CONCURRENCY,
  });
}
