"use client";

import { useEffect, useState } from "react";
import { PubChemResultCard } from "@/components/SearchResultCards";
import { searchPubChemInBrowser } from "@/lib/api/pubchemBrowser";
import { resolveLocalSearchHits } from "@/lib/data/searchLocalIndex";

type Hit = {
  cid: number;
  name: string;
  formula?: string;
  molecularWeight?: number;
  cas?: string;
  inchiKey?: string;
};

/**
 * Search order (deployed App Hosting often gets PubChem 503 on server egress):
 * 1) Instant local hub + package index
 * 2) Browser → PubChem (user IP, usually works)
 * 3) Server /api/search/pubchem (fallback)
 */
export function SearchResults({ query }: { query: string }) {
  const q = query.trim();
  const [hits, setHits] = useState<Hit[]>(() =>
    q ? resolveLocalSearchHits(q, 10) : []
  );
  const [loading, setLoading] = useState(Boolean(q));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!q) {
      setHits([]);
      setLoading(false);
      setError(null);
      setNote(null);
      return;
    }

    const local = resolveLocalSearchHits(q, 10);
    setHits(local);
    setLoading(true);
    setError(null);
    setNote(
      local.length
        ? "Searching PubChem from your browser…"
        : "Searching PubChem…"
    );

    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 25_000);

    void (async () => {
      try {
        // 1) Browser-direct PubChem (avoids Cloud Run 503)
        const browser = await searchPubChemInBrowser(q, 10, ac.signal);
        if (browser.hits.length > 0) {
          setHits(browser.hits);
          setError(null);
          setNote(null);
          return;
        }

        // 2) Server API (hub fallbacks + server-side PUG)
        const res = await fetch(
          `/api/search/pubchem?q=${encodeURIComponent(q)}&limit=10`,
          { signal: ac.signal, cache: "no-store" }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            hits?: Hit[];
            failure?: string | null;
            usedLocalFallback?: boolean;
          };
          const next = data.hits ?? [];
          if (next.length > 0) {
            setHits(next);
            setError(null);
            setNote(
              data.usedLocalFallback
                ? "Showing catalog matches (PubChem busy on server). Cards open live dossiers."
                : null
            );
            return;
          }
        }

        // 3) Keep local if we had any
        if (local.length > 0) {
          setHits(local);
          setError(null);
          setNote(
            "PubChem did not return live hits — showing known catalog CIDs. Open a card for the dossier."
          );
          return;
        }

        // Pure numeric CID always openable even if properties fail
        if (/^\d+$/.test(q)) {
          const cid = Number(q);
          if (cid > 0) {
            setHits([{ cid, name: `CID ${cid}` }]);
            setError(null);
            setNote("Opened as PubChem CID (name lookup was unavailable).");
            return;
          }
        }

        setHits([]);
        setError(
          browser.error && browser.error !== "No PubChem hits"
            ? `Search issue: ${browser.error}. Try a CID (e.g. 2244) or a common drug name.`
            : "No PubChem hits. Try another name, CAS, or CID (e.g. 2244)."
        );
        setNote(null);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          if (local.length) {
            setHits(local);
            setNote("Search timed out — showing known catalog matches.");
            setError(null);
          } else if (/^\d+$/.test(q)) {
            setHits([{ cid: Number(q), name: `CID ${q}` }]);
            setError(null);
            setNote("Timed out — use this CID card to open the live dossier.");
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

  return (
    <section id="pubchem-results" className="mt-10">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
        PubChem results (NIH)
        {loading ? (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-400">
            updating…
          </span>
        ) : null}
      </h2>

      {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}
      {note && !error ? (
        <p className="mb-3 text-sm text-slate-400">{note}</p>
      ) : null}

      {!error && !loading && hits.length === 0 ? (
        <p className="text-sm text-slate-500">
          No PubChem hits for this query. Try a different name, CAS RN, CID, InChIKey, or
          SMILES.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {hits.map((hit) => (
          <li key={hit.cid}>
            <PubChemResultCard
              href={`/compounds/pubchem/${hit.cid}`}
              cid={hit.cid}
              name={hit.name}
              formula={hit.formula}
              molecularWeight={hit.molecularWeight}
              cas={hit.cas}
              inchiKey={hit.inchiKey}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
