/**
 * Multi-source free-public molecule search.
 * GET ?q=...&limit=16
 */

import { NextRequest, NextResponse } from "next/server";
import { multiSourceSearch } from "@/lib/search/multiSourceSearch";

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
      schema: "chemistry-recipes.multi-source-search.v1",
      q: "",
      hits: [],
      sourceStatus: [],
      durationMs: 0,
    });
  }

  try {
    const result = await multiSourceSearch(q, limit);
    // Strip bulky traces from default response (keep counts)
    const rest = { ...result };
    const traceCount = rest.traces?.length ?? 0;
    delete rest.traces;
    return NextResponse.json({
      ...rest,
      traceCount,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Multi-source search failed",
        q,
        hits: [],
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({
    endpoint: "GET /api/search/multi?q=aspirin&limit=16",
    sources: [
      "local",
      "pubchem",
      "chembl",
      "chebi",
      "mychem",
      "rxnorm",
      "gsrs",
      "drugcentral",
      "openfda",
      "kegg",
      "europepmc",
      "openalex",
      "crossref",
      "semanticscholar",
      "pubmed",
      "arxiv",
    ],
    suggest: "GET /api/search/suggest?q=asp",
    problem: "GET /api/search/problem?q=hydrogenation",
    note: "Free-public fan-out; merges to openable PubChem CIDs when possible. Not GMP.",
  });
}
