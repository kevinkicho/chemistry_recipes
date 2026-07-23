import type { Metadata } from "next";
import { SearchForm } from "@/components/SearchForm";
import { PubChemResultCard } from "@/components/SearchResultCards";
import { searchPubChem, type PubChemHit } from "@/lib/api/pubchem";

export const metadata: Metadata = {
  title: "Search",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let pubchemHits: PubChemHit[] = [];
  let pubchemError: string | null = null;
  if (query) {
    try {
      const result = await searchPubChem(query, 10);
      pubchemHits = result.hits;
      if (result.hits.length === 0 && result.traces.some((t) => !t.ok)) {
        pubchemError = "PubChem request failed. Try again shortly.";
      }
    } catch {
      pubchemError = "PubChem request failed. Try again shortly.";
    }
  }

  return (
    <div className="w-full p-3 sm:p-4">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Search</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Free public search via PubChem (NCBI / NIH). Use{" "}
        <strong className="font-medium text-slate-300">name, CAS RN, SMILES, InChIKey, UNII, or CID</strong>.
        Open <strong className="font-medium text-slate-300">API</strong> on a result for deep link,
        endpoint, live response, and fetch time. For faceted modality / role browsing, use{" "}
        <a href="/catalog" className="text-teal-400 hover:underline">
          Catalog
        </a>
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
          {!pubchemError && pubchemHits.length === 0 && (
            <p className="text-sm text-slate-500">No PubChem hits for this query.</p>
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
