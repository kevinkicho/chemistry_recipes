import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

type Props = { params: Promise<{ slug: string }> };

/** Curated dossiers removed — send users to free public search. */
export default async function LegacyDossierPage({ params }: Props) {
  const { slug } = await params;
  // Prefer treating slug as a search query (name/id) via PubChem
  redirect(routes.search(decodeURIComponent(slug)));
}
