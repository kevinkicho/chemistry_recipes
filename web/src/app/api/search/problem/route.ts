/**
 * Problem-first multi-source search.
 * GET ?q=hydrogenation&limit=16
 */

import { NextRequest, NextResponse } from "next/server";
import { searchProblemFirstMulti } from "@/lib/search/problemMultiSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    24,
    Math.max(1, Number(url.searchParams.get("limit") || "16") || 16)
  );

  if (!q) {
    return NextResponse.json({
      schema: "chemistry-recipes.problem-multi-search.v1",
      q: "",
      localHits: [],
      moleculeHits: [],
      literatureHits: [],
      unified: [],
      sourceStatus: [],
      durationMs: 0,
      summary: "q required",
    });
  }

  try {
    const result = await searchProblemFirstMulti(q, limit);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Problem search failed",
        q,
        unified: [],
      },
      { status: 500 }
    );
  }
}
