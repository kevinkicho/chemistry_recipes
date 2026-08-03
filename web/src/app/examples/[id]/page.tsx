import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

type Props = { params: Promise<{ id: string }> };

/**
 * Mock Tier-A example dossiers removed.
 * Redirect to live densify search / PubChem path.
 */
export default async function ExampleDossierPage({ params }: Props) {
  const { id } = await params;
  // Known teaching names → live CID search; unknown → general search
  const known: Record<string, number> = {
    aspirin: 2244,
    ibuprofen: 3672,
    paracetamol: 1983,
    acetaminophen: 1983,
    menthol: 16666,
    metformin: 4091,
    caffeine: 2519,
    ethanol: 702,
    amoxicillin: 33613,
    sitagliptin: 4369359,
    "penicillin-g": 5904,
  };
  const cid = known[id.trim().toLowerCase()];
  if (cid) redirect(routes.pubchem(cid));
  redirect(routes.search(id));
}
