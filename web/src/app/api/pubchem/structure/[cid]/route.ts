/**
 * Server-side PubChem structure PNG proxy.
 *
 * Browsers never call NIH directly for PNGs (avoids console 503 spam under
 * ServerBusy). Retries + short serial backoff; on failure returns a 200 SVG
 * placeholder so <img> never logs a failed network request.
 */

import { NextResponse } from "next/server";
import {
  pubchemStructureUpstreamUrl,
  type PubchemStructureSize,
} from "@/lib/api/pubchem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ cid: string }> };

const UA = "ChemistryRecipes/1.2 (educational; structure proxy; polite)";
const RETRIES = 3;
const BASE_DELAY_MS = 400;

/** In-flight de-dupe so parallel cards for the same CID hit PubChem once. */
const inflight = new Map<string, Promise<Uint8Array | null>>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(status: number): boolean {
  return status === 0 || status === 429 || status === 502 || status === 503 || status === 504;
}

function placeholderSvg(cid: number, dim: number): string {
  const label = Number.isFinite(cid) && cid > 0 ? `CID ${cid}` : "Structure";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="Structure unavailable">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <rect x="8" y="8" width="${dim - 16}" height="${dim - 16}" rx="10" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="50%" y="46%" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="12">Structure unavailable</text>
  <text x="50%" y="58%" text-anchor="middle" fill="#475569" font-family="system-ui,sans-serif" font-size="10">${label} · PubChem busy</text>
</svg>`;
}

async function fetchUpstreamPng(
  cid: number,
  size: PubchemStructureSize
): Promise<Uint8Array | null> {
  const key = `${cid}:${size}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const work = (async () => {
    const url = pubchemStructureUpstreamUrl(cid, size);
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            Accept: "image/png,image/*;q=0.8,*/*;q=0.5",
            "User-Agent": UA,
          },
          // Success is cacheable at the CDN/edge; failures should revalidate soon.
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (res.ok) {
          const buf = new Uint8Array(await res.arrayBuffer());
          // Guard against HTML/error bodies served as 200
          if (buf.length > 80 && buf[0] === 0x89 && buf[1] === 0x50) {
            return buf;
          }
          // Some responses may still be PNG without classic magic in edge cases
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("image/png") && buf.length > 200) return buf;
        }
        if (!isRetryable(res.status) && res.status !== 404) {
          return null;
        }
      } catch {
        // network / timeout — retry
      }
      if (attempt < RETRIES) {
        await sleep(BASE_DELAY_MS * Math.pow(1.7, attempt) + Math.random() * 200);
      }
    }
    return null;
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const { cid: cidStr } = await ctx.params;
  const cid = Number(cidStr);
  if (!Number.isFinite(cid) || cid <= 0 || !Number.isInteger(cid)) {
    return new NextResponse("Invalid CID", { status: 400 });
  }

  const url = new URL(req.url);
  const sizeParam = (url.searchParams.get("size") || "large").toLowerCase();
  const size: PubchemStructureSize = sizeParam === "small" ? "small" : "large";
  const dim = size === "small" ? 150 : 300;

  const png = await fetchUpstreamPng(cid, size);
  if (png) {
    return new NextResponse(Buffer.from(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Structure-Source": "pubchem-pug",
      },
    });
  }

  const svg = placeholderSvg(cid, dim);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Short cache so a temporary NIH outage can recover without hard refresh forever
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-Structure-Source": "placeholder",
    },
  });
}
