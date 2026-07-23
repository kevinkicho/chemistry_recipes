import { redirect } from "next/navigation";
import { getExampleById } from "@/lib/data/examples";
import { routes } from "@/lib/routes";

type Props = { params: Promise<{ id: string }> };

/**
 * Legacy path: if id matches an example dossier, open the example.
 * Otherwise send to search — never injects examples into PubChem search.
 */
export default async function LegacyMoleculeRedirect({ params }: Props) {
  const { id } = await params;
  const key = decodeURIComponent(id);
  const example = getExampleById(key);
  if (example) redirect(routes.example(example.id));
  redirect(routes.search(key));
}
