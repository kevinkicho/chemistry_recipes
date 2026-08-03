"use client";

import { useEffect, useState } from "react";
import { MultiSourceResultCard } from "@/components/SearchResultCards";
import { searchPubChemInBrowser } from "@/lib/api/pubchemBrowser";
import { resolveLocalSearchHits } from "@/lib/data/searchLocalIndex";
import type {
  MultiSourceHit,
  MultiSourceSearchResult,
} from "@/lib/search/multiSourceSearch";

/**
 * Search order:
 * 1) Instant local hub + package index
 * 2) Browser → PubChem (user IP)
 * 3) Server multi-source fan-out (PubChem + ChEMBL + ChEBI + MyChem + RxNorm + GSRS + DrugCentral)
 * 4) Server PubChem-only fallback
 */
export function SearchResults({ query }: { query: string }) {
  const q = query.trim();
  const [hits, setHits] = useState<MultiSourceHit[]>(() =>
    q
      ? resolveLocalSearchHits(q, 10).map((h) => ({
          cid: h.cid,
          name: h.name,
          cas: h.cas,
          sources: [
            {
              source: "local" as const,
              label: "Local hub / package",
              externalId: String(h.cid),
            },
          ],
          score: 50,
          openable: true,
        }))
      : []
  );
  const [loading, setLoading] = useState(Boolean(q));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<
    MultiSourceSearchResult["sourceStatus"]
  >([]);

  useEffect(() => {
    if (!q) {
      setHits([]);
      setLoading(false);
      setError(null);
      setNote(null);
      setSourceStatus([]);
      return;
    }

    const local = resolveLocalSearchHits(q, 10).map((h) => ({
      cid: h.cid,
      name: h.name,
      cas: h.cas,
      sources: [
        {
          source: "local" as const,
          label: "Local hub / package",
          externalId: String(h.cid),
        },
      ],
      score: 50,
      openable: true,
    }));
    setHits(local);
    setLoading(true);
    setError(null);
    setSourceStatus([]);
    setNote(
      local.length
        ? "Searching free-public sources (PubChem + multi-API)…"
        : "Multi-source free-public search…"
    );

    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 45_000);

    void (async () => {
      try {
        // 1) Browser-direct PubChem for fast openable cards
        const browser = await searchPubChemInBrowser(q, 10, ac.signal);
        if (browser.hits.length > 0) {
          setHits(
            browser.hits.map((h) => ({
              cid: h.cid,
              name: h.name,
              formula: h.formula,
              molecularWeight: h.molecularWeight,
              cas: h.cas,
              inchiKey: h.inchiKey,
              sources: [
                {
                  source: "pubchem" as const,
                  label: "PubChem · NIH",
                  externalId: String(h.cid),
                  url: `https://pubchem.ncbi.nlm.nih.gov/compound/${h.cid}`,
                },
              ],
              score: 45,
              openable: true,
            }))
          );
          setNote("PubChem browser hits — enriching with multi-source fan-out…");
        }

        // 2) Server multi-source (merges ChEMBL, ChEBI, MyChem, RxNorm, GSRS, DrugCentral)
        const multiRes = await fetch(
          `/api/search/multi?q=${encodeURIComponent(q)}&limit=16`,
          { signal: ac.signal, cache: "no-store" }
        );
        if (multiRes.ok) {
          const data = (await multiRes.json()) as MultiSourceSearchResult & {
            error?: string;
          };
          if (data.hits?.length) {
            setHits(data.hits);
            setSourceStatus(data.sourceStatus || []);
            setError(null);
            setNote(
              data.note
                ? `${data.note} · AI dual-view densifies free-public evidence on open.`
                : "Multi-source free-public hits — open a CID for AI dual-view dossier."
            );
            // Latency: warm top openable CIDs in background (server densify cache)
            const warmCids = data.hits
              .filter((h) => h.openable && h.cid && h.cid > 0)
              .slice(0, 2)
              .map((h) => h.cid as number);
            if (warmCids.length) {
              void fetch("/api/dossier/warm-queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cids: warmCids }),
                keepalive: true,
              }).catch(() => {
                /* best-effort */
              });
            }
            return;
          }
        }

        // 3) Server PubChem-only fallback
        const res = await fetch(
          `/api/search/pubchem?q=${encodeURIComponent(q)}&limit=10`,
          { signal: ac.signal, cache: "no-store" }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            hits?: Array<{
              cid: number;
              name: string;
              formula?: string;
              molecularWeight?: number;
              cas?: string;
              inchiKey?: string;
            }>;
            usedLocalFallback?: boolean;
          };
          const next = data.hits ?? [];
          if (next.length > 0) {
            setHits(
              next.map((h) => ({
                cid: h.cid,
                name: h.name,
                formula: h.formula,
                molecularWeight: h.molecularWeight,
                cas: h.cas,
                inchiKey: h.inchiKey,
                sources: [
                  {
                    source: "pubchem" as const,
                    label: "PubChem · NIH",
                    externalId: String(h.cid),
                  },
                ],
                score: 40,
                openable: true,
              }))
            );
            setError(null);
            setNote(
              data.usedLocalFallback
                ? "Showing catalog matches (PubChem busy). Cards open live dossiers."
                : "PubChem-only results (multi-source empty)."
            );
            return;
          }
        }

        if (local.length > 0) {
          setHits(local);
          setError(null);
          setNote(
            "Live multi-source search thin — showing known catalog CIDs."
          );
          return;
        }

        if (/^\d+$/.test(q)) {
          const cid = Number(q);
          if (cid > 0) {
            setHits([
              {
                cid,
                name: `CID ${cid}`,
                sources: [
                  {
                    source: "pubchem",
                    label: "PubChem · NIH",
                    externalId: String(cid),
                  },
                ],
                score: 30,
                openable: true,
              },
            ]);
            setError(null);
            setNote("Opened as PubChem CID.");
            return;
          }
        }

        setHits([]);
        setError(
          "No free-public hits across identity + process literature sources (PubChem…OpenAlex/Crossref). Try a CID or CAS."
        );
        setNote(null);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          if (local.length) {
            setHits(local);
            setNote("Search timed out — showing known catalog matches.");
            setError(null);
          } else if (/^\d+$/.test(q)) {
            setHits([
              {
                cid: Number(q),
                name: `CID ${q}`,
                sources: [
                  {
                    source: "pubchem",
                    label: "PubChem · NIH",
                    externalId: q,
                  },
                ],
                score: 30,
                openable: true,
              },
            ]);
            setError(null);
            setNote("Timed out — use this CID card for the live dossier.");
          } else {
            setError("Search timed out. Try a CID or retry shortly.");
          }
        } else if (local.length) {
          setHits(local);
          setNote("Live search failed — showing known catalog matches.");
          setError(null);
        } else {
          setError(e instanceof Error ? e.message : "Search failed");
        }
      } finally {
        window.clearTimeout(t);
        setLoading(false);
      }
    })();

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  if (!q) return null;

  const openable = hits.filter((h) => h.openable && h.cid);
  const identityOnly = hits.filter((h) => !h.openable || !h.cid);

  return (
    <section id="pubchem-results" className="mt-10">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Multi-source results
        {loading ? (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-400">
            updating…
          </span>
        ) : null}
      </h2>

      {sourceStatus.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
          {sourceStatus.map((s) => (
            <li
              key={s.source}
              className={`rounded-full px-2 py-0.5 font-mono ring-1 ring-inset ${
                s.ok
                  ? "bg-teal-500/10 text-teal-200 ring-teal-500/30"
                  : "bg-slate-900 text-slate-600 ring-slate-800"
              }`}
              title={s.detail || undefined}
            >
              {s.source}
              {s.ok ? ` · ${s.hitCount}` : " · —"}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}
      {note && !error ? (
        <p className="mb-3 text-sm text-slate-400">{note}</p>
      ) : null}

      {!error && !loading && hits.length === 0 ? (
        <p className="text-sm text-slate-500">
          No free-public hits for this query. Try a different name, CAS RN, CID,
          InChIKey, or UNII.
        </p>
      ) : null}

      {openable.length > 0 ? (
        <ul className="space-y-2">
          {openable.map((h) => (
            <li key={`cid-${h.cid}-${h.name}`}>
              <MultiSourceResultCard hit={h} />
            </li>
          ))}
        </ul>
      ) : null}

      {identityOnly.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Identity hits without resolved CID
          </h3>
          <ul className="space-y-2">
            {identityOnly.map((h, i) => (
              <li key={`id-${h.name}-${i}`}>
                <MultiSourceResultCard hit={h} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
