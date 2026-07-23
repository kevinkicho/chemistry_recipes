import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy route: AI settings live in the header modal now.
 * Deep links land on home; open the AI control in the top bar.
 */
export default function AiSettingsPage() {
  redirect("/?ai=1");
}
