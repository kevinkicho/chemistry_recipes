import type { Metadata } from "next";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { SearchResults } from "@/components/SearchResults";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Search",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  return (
    <div className="w-full p-3 sm:p-4">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Search</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Free-public multi-source search:{" "}
        <strong className="font-medium text-slate-300">
          PubChem, ChEMBL, ChEBI, MyChem, RxNorm, GSRS, DrugCentral, openFDA,
          KEGG, Europe PMC, OpenAlex, Crossref, Semantic Scholar, PubMed, arXiv
        </strong>{" "}
        + local hub index (autocomplete too). Query by{" "}
        <strong className="font-medium text-slate-300">
          name, CAS RN, SMILES, InChIKey, UNII, or CID
        </strong>
        . Hits merge toward openable{" "}
        <strong className="font-medium text-slate-300">live multi-API dossiers</strong>
        . Teaching packages live under{" "}
        <Link href={routes.info()} className="text-amber-300/90 hover:underline">
          Info
        </Link>
        .
      </p>
      <div className="mt-6 max-w-xl">
        <SearchForm initialQuery={query} />
      </div>

      {!query ? (
        <p id="search-help" className="mt-10 text-sm text-slate-500">
          Examples:{" "}
          <Link href={routes.search("aspirin")} className="text-teal-400 hover:underline">
            aspirin
          </Link>
          ,{" "}
          <Link href={routes.search("50-78-2")} className="text-teal-400 hover:underline">
            50-78-2
          </Link>
          ,{" "}
          <Link href={routes.search("2244")} className="text-teal-400 hover:underline">
            2244
          </Link>
          , or paste an InChIKey.
        </p>
      ) : (
        <SearchResults query={query} />
      )}
    </div>
  );
}
