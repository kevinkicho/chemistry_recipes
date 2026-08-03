import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** Curated packages retired — live densify only. */
export default function PackagesPage() {
  redirect(routes.search());
}
