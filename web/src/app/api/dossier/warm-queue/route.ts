/**
 * POST /api/dossier/warm-queue
 * Server-side free-public densify warm for a short CID list (durable gather).
 * Body: { cids: number[], force?: boolean, concurrency?: number }
 */

import { NextResponse } from "next/server";
import { gatherCompoundEvidence } from "@/lib/dossier/gather";
import { mapPool } from "@/lib/dossier/parallelMap";
import { countSoftFailures } from "@/lib/dossier/gatherResilience";
import { countProcedureChars } from "@/lib/dossier/gatherResilience";

export const maxDuration = 300;

const MAX_CIDS = 8;

export async function POST(req: Request) {
  let body: { cids?: number[]; force?: boolean; concurrency?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const cids = (body.cids || [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, MAX_CIDS);

  if (!cids.length) {
    return NextResponse.json(
      { error: "Provide 1–8 PubChem CIDs" },
      { status: 400 }
    );
  }

  const concurrency = Math.min(3, Math.max(1, body.concurrency ?? 2));
  const force = Boolean(body.force);
  const started = Date.now();

  try {
    const results = await mapPool(cids, concurrency, async (cid) => {
      try {
        const ev = await gatherCompoundEvidence(cid, { force });
        return {
          cid,
          ok: true as const,
          literature: ev.literature?.length ?? 0,
          patents: ev.patents?.length ?? 0,
          procedureChars: countProcedureChars({
            procedureExcerpts: ev.procedureExcerpts,
            literature: ev.literature,
            patents: ev.patents,
            manufacturingTexts: ev.view?.manufacturingTexts,
          }),
          softFails: countSoftFailures(ev.fetchErrors),
          name: ev.identity?.name,
        };
      } catch (e) {
        return {
          cid,
          ok: false as const,
          error: e instanceof Error ? e.message : "warm failed",
        };
      }
    });

    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;

    return NextResponse.json({
      ok: fail === 0,
      warmed: ok,
      fail,
      durationMs: Date.now() - started,
      concurrency,
      force,
      results,
      detail: `Warm queue · ${ok} ok · ${fail} fail · ${concurrency} concurrent`,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "warm-queue failed",
      },
      { status: 500 }
    );
  }
}
