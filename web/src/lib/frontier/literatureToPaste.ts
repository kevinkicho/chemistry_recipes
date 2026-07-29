/**
 * Literature → local paste densify.
 * Attach free-public paper abstracts / procedure excerpts as CID user supplements
 * so process-fact re-extract and atlas can use them. Not GMP; public text only.
 */

import type { LiteratureHit } from "@/lib/api/europePmc";
import {
  enrichLiteratureWithOaFullText,
  fetchEuropePmcFullTextXml,
} from "@/lib/api/europePmc";
import type { PatentHit } from "@/lib/api/patentsView";
import { saveUserSupplement } from "@/lib/idb/userSupplements";
import { scoreProcedureWindow } from "@/lib/literature/procedureWindowScore";
import {
  getCachedDossier,
  putCachedDossierAndNotify,
} from "@/lib/idb/dossierCache";
import { applyLocalFactEnrichment } from "@/lib/dossier/enrichClientFacts";
import { ensureDossierKnowledge } from "@/lib/frontier/knowledgeFingerprint";
import { withIdealPageParity } from "@/lib/dossier/idealPage";

export interface LiteraturePasteAttachResult {
  schema: "chemistry-recipes.literature-to-paste.v1";
  cid: number;
  attempted: number;
  attached: number;
  skipped: number;
  totalChars: number;
  labels: string[];
  /** How many hits gained OA full-text before paste */
  oaEnriched?: number;
}

function textFromHit(h: LiteratureHit): string {
  const parts = [
    h.title && `Title: ${h.title}`,
    h.authors && `Authors: ${h.authors}`,
    h.journal && `Journal: ${h.journal}`,
    h.year && `Year: ${h.year}`,
    h.fullTextExcerpt || h.abstract,
    h.doi && `DOI: ${h.doi}`,
    h.url && `URL: ${h.url}`,
  ].filter(Boolean);
  return parts.join("\n\n").trim();
}

/** Map a patent hit into literature shape for shared paste attach. */
export function patentHitToLiterature(p: PatentHit): LiteratureHit {
  return {
    id: p.id || p.patentNumber,
    source: "Patent",
    title: p.title,
    abstract: p.abstract,
    fullTextExcerpt: p.procedureExcerpt || p.abstract,
    fullTextChars: (p.procedureExcerpt || p.abstract || "").length,
    url: p.url,
    year: p.date?.slice(0, 4),
  };
}

/**
 * If hit has PMCID (or PMC source) and thin body, fetch Europe PMC OA full text.
 */
export async function enrichHitWithOaFullTextIfPossible(
  hit: LiteratureHit
): Promise<{ hit: LiteratureHit; enriched: boolean }> {
  const alreadyDense = (hit.fullTextExcerpt?.length || 0) >= 400;
  const pmcid =
    hit.pmcid ||
    (hit.source === "PMC" || /PMC/i.test(hit.source || "")
      ? String(hit.id || "").replace(/^PMC/i, "")
      : "");
  if (alreadyDense || !pmcid) {
    // Still try if pmcid in url
    const fromUrl = /PMC(\d+)/i.exec(hit.url || "");
    if (alreadyDense || !fromUrl) {
      return { hit, enriched: false };
    }
    const id = fromUrl[1]!;
    try {
      const ft = await fetchEuropePmcFullTextXml(id);
      if (ft.excerpt && ft.excerpt.length >= 80) {
        return {
          hit: {
            ...hit,
            pmcid: hit.pmcid || `PMC${id}`,
            fullTextExcerpt: ft.excerpt,
            fullTextChars: ft.plain.length,
            isOpenAccess: true,
            abstract:
              hit.abstract && hit.abstract.length >= 200
                ? hit.abstract
                : ft.excerpt.slice(0, 1500),
          },
          enriched: true,
        };
      }
    } catch {
      return { hit, enriched: false };
    }
    return { hit, enriched: false };
  }
  try {
    const ft = await fetchEuropePmcFullTextXml(pmcid);
    if (ft.excerpt && ft.excerpt.length >= 80) {
      return {
        hit: {
          ...hit,
          fullTextExcerpt: ft.excerpt,
          fullTextChars: ft.plain.length,
          isOpenAccess: true,
          abstract:
            hit.abstract && hit.abstract.length >= 200
              ? hit.abstract
              : ft.excerpt.slice(0, 1500),
        },
        enriched: true,
      };
    }
  } catch {
    /* keep original */
  }
  return { hit, enriched: false };
}

/**
 * Batch enrich OA candidates (capped) before densify paste.
 */
export async function enrichLiteratureHitsForPaste(
  hits: LiteratureHit[],
  opts?: { maxArticles?: number }
): Promise<{ hits: LiteratureHit[]; oaEnriched: number }> {
  const { hits: enriched, traces: _t } = await enrichLiteratureWithOaFullText(
    hits,
    { maxArticles: opts?.maxArticles ?? 4 }
  );
  void _t;
  let oaEnriched = 0;
  for (let i = 0; i < hits.length; i++) {
    const before = hits[i]!.fullTextExcerpt?.length || 0;
    const after = enriched[i]?.fullTextExcerpt?.length || 0;
    if (after > before + 40) oaEnriched += 1;
  }
  // Also try single-hit path for PMCID present but not flagged OA
  const out = [...enriched];
  for (let i = 0; i < out.length && oaEnriched < (opts?.maxArticles ?? 4); i++) {
    const h = out[i]!;
    if ((h.fullTextExcerpt?.length || 0) >= 400) continue;
    if (!h.pmcid && !/PMC\d+/i.test(h.url || "") && h.source !== "PMC") {
      continue;
    }
    const r = await enrichHitWithOaFullTextIfPossible(h);
    if (r.enriched) {
      out[i] = r.hit;
      oaEnriched += 1;
    }
  }
  return { hits: out, oaEnriched };
}

/**
 * Attach a single paper (or patent-as-lit) as densify paste for this CID.
 * Fetches OA full text when PMCID is available. Rematerializes IndexedDB if cached.
 */
export async function attachOneLiteratureHitToCid(
  cid: number,
  hit: LiteratureHit
): Promise<
  LiteraturePasteAttachResult & { rematerialized: boolean; oaEnriched: number }
> {
  const { hit: dense, enriched } = await enrichHitWithOaFullTextIfPossible(hit);
  const res = attachLiteratureHitsToCid(cid, [dense], {
    max: 1,
    minChars: 40,
    minScore: 0,
  });
  let rematerialized = false;
  if (res.attached > 0) {
    const m = await rematerializeCachesWithLocalPastes([cid]);
    rematerialized = m.updated > 0;
  }
  return {
    ...res,
    oaEnriched: enriched ? 1 : 0,
    rematerialized,
  };
}

/**
 * Attach multiple hits after OA enrichment (for table batch paste).
 */
export async function attachLiteratureHitsToCidWithOa(
  cid: number,
  hits: LiteratureHit[],
  opts?: { max?: number; minChars?: number; minScore?: number; maxOa?: number }
): Promise<LiteraturePasteAttachResult & { rematerialized: boolean }> {
  const { hits: dense, oaEnriched } = await enrichLiteratureHitsForPaste(hits, {
    maxArticles: opts?.maxOa ?? opts?.max ?? 4,
  });
  const res = attachLiteratureHitsToCid(cid, dense, opts);
  let rematerialized = false;
  if (res.attached > 0) {
    const m = await rematerializeCachesWithLocalPastes([cid]);
    rematerialized = m.updated > 0;
  }
  return { ...res, oaEnriched, rematerialized };
}

/**
 * Save process-relevant literature text as local densify pastes for a CID.
 */
export function attachLiteratureHitsToCid(
  cid: number,
  hits: LiteratureHit[],
  opts?: { max?: number; minChars?: number; minScore?: number }
): LiteraturePasteAttachResult {
  const max = opts?.max ?? 4;
  const minChars = opts?.minChars ?? 80;
  const minScore = opts?.minScore ?? 4;

  const ranked = [...hits]
    .map((h) => {
      const text = textFromHit(h);
      return {
        h,
        text,
        score: scoreProcedureWindow(
          `${h.title || ""}\n${h.fullTextExcerpt || h.abstract || ""}`
        ),
      };
    })
    .filter((x) => x.text.length >= minChars && x.score >= minScore)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)
    .slice(0, max);

  let attached = 0;
  let totalChars = 0;
  const labels: string[] = [];
  let skipped = Math.max(0, hits.length - ranked.length);

  for (const row of ranked) {
    const label = `Public lit · ${row.h.source} · ${(row.h.title || "paper").slice(0, 60)}`;
    const saved = saveUserSupplement(cid, row.text, label);
    if (saved) {
      attached += 1;
      totalChars += saved.text.length;
      labels.push(label);
    } else {
      skipped += 1;
    }
  }

  return {
    schema: "chemistry-recipes.literature-to-paste.v1",
    cid,
    attempted: ranked.length,
    attached,
    skipped,
    totalChars,
    labels,
  };
}

/**
 * Attach the same ranked process literature to multiple campaign CIDs
 * (shared free-public problem context). Caps per-CID attachments.
 * Optionally enrich OA full text first when PMCIDs are present.
 */
export async function attachLiteratureHitsToCampaignCids(
  cids: number[],
  hits: LiteratureHit[],
  opts?: { maxPerCid?: number; maxCids?: number; enrichOa?: boolean }
): Promise<{
  cidResults: LiteraturePasteAttachResult[];
  totalAttached: number;
  totalChars: number;
  oaEnriched: number;
  summary: string;
}> {
  const maxCids = opts?.maxCids ?? 8;
  const targets = cids.filter((c) => c > 0).slice(0, maxCids);
  let working = hits;
  let oaEnriched = 0;
  if (opts?.enrichOa !== false && hits.length) {
    const en = await enrichLiteratureHitsForPaste(hits, {
      maxArticles: Math.min(6, hits.length),
    });
    working = en.hits;
    oaEnriched = en.oaEnriched;
  }
  const cidResults = targets.map((cid) =>
    attachLiteratureHitsToCid(cid, working, { max: opts?.maxPerCid ?? 3 })
  );
  const totalAttached = cidResults.reduce((n, r) => n + r.attached, 0);
  const totalChars = cidResults.reduce((n, r) => n + r.totalChars, 0);
  return {
    cidResults,
    totalAttached,
    totalChars,
    oaEnriched,
    summary: totalAttached
      ? `Attached ${totalAttached} public lit paste(s) · ${totalChars.toLocaleString()} chars across ${targets.length} CID(s)` +
        (oaEnriched ? ` · OA full-text on ${oaEnriched}` : "")
      : "No procedure-rich literature text to attach",
  };
}

/**
 * Re-apply local pastes + rebuild process-knowledge on cached densify dossiers
 * so campaign agent / brief see literature-enriched facts.
 */
export async function rematerializeCachesWithLocalPastes(
  cids: number[]
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;
  for (const cid of cids) {
    const row = await getCachedDossier(cid);
    if (!row?.dossier) {
      skipped += 1;
      continue;
    }
    let d = applyLocalFactEnrichment(row.dossier);
    d = withIdealPageParity(d);
    d = ensureDossierKnowledge(d);
    await putCachedDossierAndNotify(d);
    updated += 1;
  }
  return { updated, skipped };
}
