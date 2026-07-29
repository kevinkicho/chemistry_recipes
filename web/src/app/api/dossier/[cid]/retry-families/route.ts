/**
 * POST /api/dossier/[cid]/retry-families
 * Re-query only soft-failed free-public families (polite, durable).
 */

import { NextResponse } from "next/server";
import { gatherCompoundEvidence } from "@/lib/dossier/gather";
import { retryFailedFamilies } from "@/lib/dossier/retryFailedFamilies";
import { failedFamiliesFromErrors } from "@/lib/dossier/densifyDelta";
import { putCachedEvidence } from "@/lib/dossier/serverEvidenceCache";

export const maxDuration = 120;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ cid: string }> }
) {
  const { cid: raw } = await ctx.params;
  const cid = Number(raw);
  if (!Number.isFinite(cid) || cid <= 0) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }

  let body: { families?: string[]; forceGather?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    // Start from durable cache / live gather so we have fetchErrors + payloads
    const base = await gatherCompoundEvidence(cid, {
      force: Boolean(body.forceGather),
    });
    const listed = failedFamiliesFromErrors(base.fetchErrors);
    const result = await retryFailedFamilies(base, {
      families: body.families?.length
        ? body.families
        : listed.map((f) => f.label),
      name: base.identity?.name,
    });
    putCachedEvidence(result.evidence);

    return NextResponse.json({
      ok: true,
      cid,
      retried: result.retried,
      stillFailed: result.stillFailed,
      detail: result.detail,
      softFails: (result.evidence.fetchErrors || []).filter((e) =>
        e.startsWith("soft-fail ·") || e.startsWith("api-fail ·")
      ).length,
      literatureCount: result.evidence.literature?.length ?? 0,
      patentCount: result.evidence.patents?.length ?? 0,
      familiesAvailable: listed,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "retry-families failed",
      },
      { status: 500 }
    );
  }
}
