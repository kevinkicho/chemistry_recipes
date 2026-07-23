/**
 * DailyMed REST (NLM) — free SPL setid search by drug name.
 * Docs: https://dailymed.nlm.nih.gov/dailymed/app-support.cfm#api
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const DM = "https://dailymed.nlm.nih.gov/dailymed/services/v2";

export interface DailyMedHit {
  setId: string;
  title: string;
  publishedDate?: string;
  url: string;
}

export async function fetchDailyMedByName(
  name: string
): Promise<{ hits: DailyMedHit[]; traces: ApiFetchTrace[]; query: string }> {
  const q = name.trim();
  if (!q) return { hits: [], traces: [], query: "" };

  const url = `${DM}/spls.json?drug_name=${encodeURIComponent(q)}&pagesize=5`;
  const { data, trace } = await fetchJsonWithTrace<{
    data?: Array<{
      setid?: string;
      title?: string;
      published_date?: string;
    }>;
    metadata?: { total_elements?: number };
  }>(url, { next: { revalidate: 3600 } });

  const hits: DailyMedHit[] = (data?.data ?? [])
    .filter((r) => r.setid)
    .map((r) => ({
      setId: r.setid!,
      title: r.title || q,
      publishedDate: r.published_date,
      url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${r.setid}`,
    }));

  return { hits: hits.slice(0, 5), traces: [trace], query: q };
}
