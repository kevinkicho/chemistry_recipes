/**
 * PubChem search API — used for client fallbacks and diagnostics.
 * Same logic as /search page; never invents hits.
 */

import { NextResponse } from "next/server";
import { searchPubChem } from "@/lib/api/pubchem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit") || "10") || 10)
  );

  if (!q) {
    return NextResponse.json({ hits: [], traces: [], failure: null });
  }

  const result = await searchPubChem(q, limit);
  return NextResponse.json({
    q,
    hits: result.hits,
    failure: result.failure ?? null,
    usedLocalFallback: result.usedLocalFallback ?? false,
    traceCount: result.traces.length,
    ok: result.hits.length > 0 || !result.failure,
  });
}
