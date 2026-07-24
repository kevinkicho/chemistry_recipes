"use client";

import { useEffect, useState } from "react";
import { PubChemResultCard } from "@/components/SearchResultCards";
import { resolveLocalHubCids } from "@/lib/data/hubIndex";

type Hit = {
  cid: number;
  name: string;
  formula?: string;
  molecularWeight?: number;
  cas?: string;
  inchiKey?: string;
};

/**
 * Progressive search: instant hub cards, then live /api/search/pubchem enrichment.
 * Avoids SSR hanging on PubChem 503 retries from cloud egress.
 */
export function SearchResults({ query }: { query: string }) {
  const q = query.trim();
  const [hits, setHits] = useState<Hit[]>(() =>
    q ? resolveLocalHubCids(q, 10) : []
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

    const local = resolveLocalHubCids(q, 10);
    setHits(local);
    setLoading(true);
    setError(null);
    setNote(
      local.length
        ? "Loading live PubChem details…"
        : "Querying PubChem…"
    );

    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 20000);

    void (async () => {
      try {
        const res = await fetch(
          `/api/search/pubchem?q=${encodeURIComponent(q)}&limit=10`,
          { signal: ac.signal, cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`Search API HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          hits?: Hit[];
          failure?: string | null;
          usedLocalFallback?: boolean;
          ok?: boolean;
        };
        const next = data.hits ?? [];
        if (next.length > 0) {
          setHits(next);
          setError(null);
          setNote(
            data.usedLocalFallback
              ? "Showing known hub matches (PubChem is busy on this host). Cards open live dossiers."
              : null
          );
        } else if (local.length > 0) {
          setHits(local);
          setError(null);
          setNote(
            data.failure
              ? `PubChem busy (${data.failure}). Showing known hub matches — open a card for the live dossier.`
              : "Showing known hub matches."
          );
        } else if (data.failure) {
          setError(
            `PubChem is busy (${data.failure}). Try a CID (e.g. 2244) or retry in ~30s.`
          );
          setNote(null);
        } else {
          setError(null);
          setNote(null);
          setHits([]);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          if (local.length) {
            setNote("PubChem timed out — showing known hub matches.");
            setError(null);
          } else {
            setError("Search timed out. Try a CID or retry shortly.");
          }
        } else if (local.length) {
          setNote("Live search failed — showing known hub matches.");
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
