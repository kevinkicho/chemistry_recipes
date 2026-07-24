import type { Metadata } from "next";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { PubChemResultCard } from "@/components/SearchResultCards";
import { searchPubChem, type PubChemHit } from "@/lib/api/pubchem";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Search",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let pubchemHits: PubChemHit[] = [];
  let pubchemError: string | null = null;
  let pubchemWarning: string | null = null;
  if (query) {
    try {
      const result = await searchPubChem(query, 10);
      pubchemHits = result.hits;
      // Empty + hard failure (network / 429 / 5xx) — not PubChem 400/404 "no match"
      if (result.hits.length === 0 && result.failure) {
        pubchemError = `PubChem temporarily unavailable (${result.failure}). Retry in a moment, or try a CID (e.g. 2244).`;
      } else if (result.hits.length > 0 && result.failure) {
        pubchemWarning = `Partial PubChem response (${result.failure}). Showing CID matches.`;
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown error";
      pubchemError = `PubChem request failed (${detail}). Try again shortly, or open /api/search/pubchem?q=…`;
    }
  }

  return (
    <div className="w-full p-3 sm:p-4">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Search</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Free public search via PubChem (NCBI / NIH). Use{" "}
        <strong className="font-medium text-slate-300">name, CAS RN, SMILES, InChIKey, UNII, or CID</strong>.
        Results open <strong className="font-medium text-slate-300">live multi-API dossiers</strong> only —
        not curated demos. Teaching packages and mock plant dossiers live under{" "}
        <Link href={routes.info()} className="text-amber-300/90 hover:underline">
          Info
        </Link>
        .
      </p>
      <div className="mt-6 max-w-xl">
        <SearchForm initialQuery={query} />
      </div>

      {!query && (
        <p id="search-help" className="mt-10 text-sm text-slate-500">
          Examples: <code className="text-teal-400">aspirin</code>,{" "}
          <code className="text-teal-400">50-78-2</code>,{" "}
          <code className="text-teal-400">2244</code>,{" "}
          <code className="text-teal-400">BSYNRYMUTXBXSQ-UHFFFAOYSA-N</code> (InChIKey)
        </p>
      )}

      {query && (
        <section id="pubchem-results" className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            PubChem results (NIH)
          </h2>
          {pubchemError && <p className="text-sm text-rose-400">{pubchemError}</p>}
          {pubchemWarning && !pubchemError && (
            <p className="mb-2 text-sm text-amber-300/90">{pubchemWarning}</p>
          )}
          {!pubchemError && pubchemHits.length === 0 && (
            <p className="text-sm text-slate-500">
              No PubChem hits for this query. Try a different name, CAS RN, CID, InChIKey, or
              SMILES.
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {pubchemHits.map((hit) => (
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
      )}
    </div>
  );
}
