import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** Legacy path — curated/mock hub lives at /info */
export default function AboutRedirectPage() {
  redirect(routes.info());
}
