import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** Legacy path — mock hub retired. */
export default function AboutPage() {
  redirect(routes.search());
}
