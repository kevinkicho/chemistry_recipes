"use client";

import { useEffect, useState } from "react";
import { MultiSourceResultCard } from "@/components/SearchResultCards";
import { searchPubChemInBrowser } from "@/lib/api/pubchemBrowser";
import { normalizeChemicalQuery, parsePubchemCidQuery } from "@/lib/search/queryKind";
import type {
  MultiSourceHit,
  MultiSourceSearchResult,
} from "@/lib/search/multiSourceSearch";

/** Keep real browser PubChem CID cards when server fan-out is identity-only or missed them. */
function mergeOpenableBrowserHits(
  serverHits: MultiSourceHit[],
  browserHits: MultiSourceHit[]
): MultiSourceHit[] {
  if (!browserHits.length) return serverHits;
  const seen = new Set<number>();
  for (const h of serverHits) {
    if (h.cid && h.cid > 0) seen.add(h.cid);
  }
  const extra = browserHits.filter((h) => h.cid && h.cid > 0 && !seen.has(h.cid));
  if (!extra.length) return serverHits;
  return [...extra, ...serverHits];
}

/**
 * Search order (live free-public only):
 * 1) Browser → PubChem (user IP)
 * 2) Server multi-source fan-out
 * 3) Server PubChem-only fallback
 * 4) Numeric CID open card
 */
export function SearchResults({ query }: { query: string }) {
  const q = normalizeChemicalQuery(query);
  const [hits, setHits] = useState<MultiSourceHit[]>([]);
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

    setHits([]);
    setLoading(true);
    setError(null);
    setSourceStatus([]);
    setNote("Multi-source free-public search…");

    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 45_000);

    void (async () => {
      let browserHits: MultiSourceHit[] = [];
      try {
        // 1) Browser-direct PubChem for fast openable cards
        const browser = await searchPubChemInBrowser(q, 10, ac.signal);
        browserHits = browser.hits.map((h) => ({
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
        }));
        if (browserHits.length > 0) {
          setHits(browserHits);
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
            const merged = mergeOpenableBrowserHits(data.hits, browserHits);
            setHits(merged);
            setSourceStatus(data.sourceStatus || []);
            setError(null);
            const keptBrowser = merged.length > data.hits.length;
            setNote(
              keptBrowser
                ? `${data.note ? `${data.note} · ` : ""}kept PubChem browser CID cards that server fan-out missed.`
                : data.note
                  ? `${data.note} · AI dual-view densifies free-public evidence on open.`
                  : "Multi-source free-public hits — open a CID for AI dual-view dossier."
            );
            // Latency: warm top openable CIDs in background (server densify cache)
            const warmCids = merged
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
          };
          const next = data.hits ?? [];
          if (next.length > 0) {
            const mapped: MultiSourceHit[] = next.map((h) => ({
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
            }));
            setHits(mergeOpenableBrowserHits(mapped, browserHits));
            setError(null);
            setNote("PubChem-only results (multi-source empty).");
            return;
          }
        }

        const fallbackCid = parsePubchemCidQuery(q);
        if (fallbackCid) {
          const cid = fallbackCid;
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

        // Keep real browser PubChem hits (CAS/name) when Cloud egress is empty.
        if (browserHits.length > 0) {
          setHits(browserHits);
          setError(null);
          setNote(
            "PubChem browser hits — server multi-source returned no additional matches."
          );
          return;
        }

        setHits([]);
        setError(
          "No free-public hits across identity + process literature sources (PubChem…OpenAlex/Crossref). Try a CID or CAS."
        );
        setNote(null);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          if (browserHits.length > 0) {
            setHits(browserHits);
            setError(null);
            setNote(
              "Search timed out after PubChem browser hits — open a CID or retry."
            );
          } else if (parsePubchemCidQuery(q)) {
            const timedCid = parsePubchemCidQuery(q) as number;
            setHits([
              {
                cid: timedCid,
                name: `CID ${timedCid}`,
                sources: [
                  {
                    source: "pubchem",
                    label: "PubChem · NIH",
                    externalId: String(timedCid),
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
        } else if (browserHits.length > 0) {
          setHits(browserHits);
          setError(null);
          setNote(
            "PubChem browser hits — server enrich failed. Open a CID or retry."
          );
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
          SMILES, InChI, InChIKey, or UNII.
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
