import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** Mock Tier-A example dossiers retired — live densify only. */
export default async function ExampleDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect(routes.search());
}
