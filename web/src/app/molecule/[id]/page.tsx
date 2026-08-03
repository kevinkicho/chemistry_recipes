import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

type Props = { params: Promise<{ id: string }> };

/**
 * Legacy /molecule/:id path — always live search (mock examples removed).
 */
export default async function LegacyMoleculeRedirect({ params }: Props) {
  const { id } = await params;
  const key = decodeURIComponent(id);
  // Known teaching names → live CID
  const known: Record<string, number> = {
    aspirin: 2244,
  };
  const cid = known[key.trim().toLowerCase()];
  if (cid) redirect(routes.pubchem(cid));
  redirect(routes.search(key));
}
