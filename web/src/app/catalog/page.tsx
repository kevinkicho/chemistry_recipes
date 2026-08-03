import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** Teaching catalog retired — live densify only. */
export default function CatalogPage() {
  redirect(routes.search());
}
