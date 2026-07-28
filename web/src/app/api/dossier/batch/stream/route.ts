/**
 * SSE streaming batch densify — progress event per CID.
 * Parallel pool + per-CID transient retries. Max 12 CIDs.
 */

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

function parseCidsFromUrl(url: URL): number[] {
  const raw = url.searchParams.get("cids") || "";
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => Number(s.trim()))
        .filter((c) => Number.isFinite(c) && c > 0 && c < 1e9)
    ),
  ].slice(0, MAX_CIDS);
}

async function runStream(
  cids: number[],
  opts: {
    model?: string;
    fastModel?: string;
    includeDossiers?: boolean;
    concurrency?: number;
    retries?: number;
  }
) {
  const encoder = new TextEncoder();
  let closed = false;
  const concurrency = Math.min(
    MAX_CONCURRENCY,
    Math.max(1, opts.concurrency || DEFAULT_CONCURRENCY)
  );
  const retries = Math.min(3, Math.max(0, opts.retries ?? 2));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      send({
        type: "start",
        total: cids.length,
        cids,
        concurrency,
        retries,
        t: Date.now(),
      });

      let ok = 0;
      let fail = 0;
      const t0 = Date.now();

      await mapPool(cids, concurrency, async (cid, i) => {
        send({
          type: "cid_start",
          index: i,
          total: cids.length,
          cid,
          label: `Building CID ${cid} (${i + 1}/${cids.length}, pool ${concurrency})…`,
        });
        const tCid = Date.now();
        let lastErr: unknown;
        const maxAttempts = retries + 1;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            if (attempt > 1) {
              send({
                type: "cid_progress",
                cid,
                index: i,
                label: `Retry ${attempt}/${maxAttempts} for CID ${cid}`,
              });
            }
            const dossier = await buildOneCidForBatch(cid, {
              model: opts.model,
              fastModel: opts.fastModel,
              onProgress: (label) =>
                send({
                  type: "cid_progress",
                  cid,
                  index: i,
                  label,
                }),
            });
            ok += 1;
            send({
              type: "cid_complete",
              index: i,
              total: cids.length,
              cid,
              ok: true,
              attempts: attempt,
              durationMs: Date.now() - tCid,
              summary: slimDossierSummary(dossier),
              dossier: opts.includeDossiers ? dossier : undefined,
            });
            return null;
          } catch (e) {
            lastErr = e;
            if (attempt >= maxAttempts || !isTransientError(e)) break;
            const delay = 400 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
        fail += 1;
        send({
          type: "cid_complete",
          index: i,
          total: cids.length,
          cid,
          ok: false,
          attempts: maxAttempts,
          durationMs: Date.now() - tCid,
          error: lastErr instanceof Error ? lastErr.message : "Build failed",
        });
        return null;
      });

      send({
        type: "batch_complete",
        ok,
        fail,
        total: cids.length,
        concurrency,
        retries,
        durationMs: Date.now() - t0,
      });
      if (!closed) {
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cids = parseCidsFromUrl(url);
  if (!cids.length) {
    return new Response(
      JSON.stringify({
        error: "Pass ?cids=2244,3672 (1–12)",
        endpoint: "GET|POST /api/dossier/batch/stream",
        concurrency: `1–${MAX_CONCURRENCY} (default ${DEFAULT_CONCURRENCY})`,
        retries: "0–3 (default 2)",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  return runStream(cids, {
    includeDossiers: url.searchParams.get("includeDossiers") === "1",
    model: url.searchParams.get("model") || undefined,
    fastModel: url.searchParams.get("fastModel") || undefined,
    concurrency: Number(url.searchParams.get("concurrency")) || undefined,
    retries: Number(url.searchParams.get("retries")) || undefined,
  });
}

export async function POST(req: Request) {
  let body: {
    cids?: number[];
    includeDossiers?: boolean;
    model?: string;
    fastModel?: string;
    concurrency?: number;
    retries?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }
  const fromBody = Array.isArray(body.cids)
    ? body.cids
        .map(Number)
        .filter((c) => Number.isFinite(c) && c > 0)
        .slice(0, MAX_CIDS)
    : [];
  const url = new URL(req.url);
  const cids = fromBody.length ? [...new Set(fromBody)] : parseCidsFromUrl(url);
  if (!cids.length) {
    return new Response(JSON.stringify({ error: "cids required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return runStream(cids, {
    includeDossiers: Boolean(body.includeDossiers),
    model: body.model,
    fastModel: body.fastModel,
    concurrency: body.concurrency,
    retries: body.retries,
  });
}
