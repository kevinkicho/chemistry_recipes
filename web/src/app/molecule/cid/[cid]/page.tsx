import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

type Props = { params: Promise<{ cid: string }> };

/** Legacy path → PubChem compound card. */
export default async function LegacyPubchemRedirect({ params }: Props) {
  const { cid } = await params;
  redirect(routes.pubchem(cid));
}
