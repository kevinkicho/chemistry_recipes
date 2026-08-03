import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** Curated package detail retired — live densify only. */
export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect(routes.search());
}
