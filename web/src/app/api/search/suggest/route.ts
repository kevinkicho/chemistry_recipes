/**
 * Multi-source free-public autocomplete.
 * GET ?q=...&limit=14
 */

import { NextRequest, NextResponse } from "next/server";
import { multiSourceSuggest } from "@/lib/search/multiSourceSuggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit") || "14") || 14)
  );

  if (q.length < 2) {
    return NextResponse.json({
      schema: "chemistry-recipes.multi-source-suggest.v1",
      q,
      suggestions: [],
      sourcesUsed: [],
      durationMs: 0,
    });
  }

  try {
    const result = await multiSourceSuggest(q, limit);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Suggest failed",
        suggestions: [],
      },
      { status: 500 }
    );
  }
}
