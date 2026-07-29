/**
 * Literature → local paste densify.
 * Attach free-public paper abstracts / procedure excerpts as CID user supplements
 * so process-fact re-extract and atlas can use them. Not GMP; public text only.
 */

import type { LiteratureHit } from "@/lib/api/europePmc";
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
 * Attach a single paper (or patent-as-lit) as densify paste for this CID.
 * Then rematerialize IndexedDB if a cache exists.
 */
export async function attachOneLiteratureHitToCid(
  cid: number,
  hit: LiteratureHit
): Promise<LiteraturePasteAttachResult & { rematerialized: boolean }> {
  const res = attachLiteratureHitsToCid(cid, [hit], {
    max: 1,
    minChars: 40,
    minScore: 0,
  });
  let rematerialized = false;
  if (res.attached > 0) {
    const m = await rematerializeCachesWithLocalPastes([cid]);
    rematerialized = m.updated > 0;
  }
  return { ...res, rematerialized };
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
 */
export function attachLiteratureHitsToCampaignCids(
  cids: number[],
  hits: LiteratureHit[],
  opts?: { maxPerCid?: number; maxCids?: number }
): {
  cidResults: LiteraturePasteAttachResult[];
  totalAttached: number;
  totalChars: number;
  summary: string;
} {
  const maxCids = opts?.maxCids ?? 8;
  const targets = cids.filter((c) => c > 0).slice(0, maxCids);
  const cidResults = targets.map((cid) =>
    attachLiteratureHitsToCid(cid, hits, { max: opts?.maxPerCid ?? 3 })
  );
  const totalAttached = cidResults.reduce((n, r) => n + r.attached, 0);
  const totalChars = cidResults.reduce((n, r) => n + r.totalChars, 0);
  return {
    cidResults,
    totalAttached,
    totalChars,
    summary: totalAttached
      ? `Attached ${totalAttached} public lit paste(s) · ${totalChars.toLocaleString()} chars across ${targets.length} CID(s)`
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
