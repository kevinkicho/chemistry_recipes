import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** Mock / teaching hub retired — live densify only. */
export default function InfoPage() {
  redirect(routes.search());
}
