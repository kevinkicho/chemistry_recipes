import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleDossierView } from "@/components/ExampleDossierView";
import { getExampleById, getExampleDossiers } from "@/lib/data/examples";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return getExampleDossiers().map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = getExampleById(id);
  if (!d) return { title: "Example" };
  return {
    title: `${d.identifiers.name} · Example dossier`,
    description: d.overview.slice(0, 160),
  };
}

/**
 * Curated example dossiers for demonstration only.
 * Not resolved from search; not mixed with live PubChem API pages.
 */
export default async function ExampleDossierPage({ params }: Props) {
  const { id } = await params;
  const d = getExampleById(id);
  if (!d) notFound();
  return <ExampleDossierView d={d} />;
}
