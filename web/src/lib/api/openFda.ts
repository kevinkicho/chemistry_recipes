/**
 * openFDA free public drug APIs (label + Drugs@FDA).
 * Docs: https://open.fda.gov/
 * No key required for modest volume.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const FDA = "https://api.fda.gov";

export interface OpenFdaLabelHit {
  id: string;
  brandName?: string;
  genericName?: string;
  manufacturer?: string;
  indications?: string;
  description?: string;
  dosageForm?: string;
  route?: string;
  url: string;
  source: "openfda-label" | "openfda-drugsfda";
}

function firstStr(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 800);
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim().slice(0, 800);
  return undefined;
}

/**
 * Search openFDA drug label + Drugs@FDA by open-text drug name.
 */
export async function fetchOpenFdaByName(
  name: string
): Promise<{ hits: OpenFdaLabelHit[]; traces: ApiFetchTrace[]; query: string }> {
  const q = name.trim();
  if (!q) return { hits: [], traces: [], query: "" };

  const traces: ApiFetchTrace[] = [];
  const hits: OpenFdaLabelHit[] = [];
  const safe = q.replace(/"/g, "");

  const labelUrl =
    `${FDA}/drug/label.json?search=` +
    encodeURIComponent(
      `openfda.generic_name:"${safe}" OR openfda.brand_name:"${safe}" OR openfda.substance_name:"${safe}"`
    ) +
    `&limit=3`;

  const label = await fetchJsonWithTrace<{
    results?: Array<{
      id?: string;
      set_id?: string;
      openfda?: {
        brand_name?: string[];
        generic_name?: string[];
        manufacturer_name?: string[];
        route?: string[];
        dosage_form?: string[];
      };
      indications_and_usage?: string[];
      description?: string[];
    }>;
    error?: { message?: string };
  }>(labelUrl, { next: { revalidate: 3600 } });
  traces.push(label.trace);

  for (const r of label.data?.results ?? []) {
    const brand = firstStr(r.openfda?.brand_name);
    const generic = firstStr(r.openfda?.generic_name);
    hits.push({
      id: `label:${r.id || r.set_id || hits.length}`,
      brandName: brand,
      genericName: generic,
      manufacturer: firstStr(r.openfda?.manufacturer_name),
      indications: firstStr(r.indications_and_usage),
      description: firstStr(r.description),
      dosageForm: firstStr(r.openfda?.dosage_form),
      route: firstStr(r.openfda?.route),
      url: r.set_id
        ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${r.set_id}`
        : "https://open.fda.gov/apis/drug/label/",
      source: "openfda-label",
    });
  }

  const drugsUrl =
    `${FDA}/drug/drugsfda.json?search=` +
    encodeURIComponent(
      `openfda.generic_name:"${safe}" OR openfda.brand_name:"${safe}" OR products.brand_name:"${safe}"`
    ) +
    `&limit=3`;

  const drugs = await fetchJsonWithTrace<{
    results?: Array<{
      application_number?: string;
      sponsor_name?: string;
      products?: Array<{ brand_name?: string; dosage_form?: string; route?: string }>;
      openfda?: { generic_name?: string[]; brand_name?: string[] };
    }>;
  }>(drugsUrl, { next: { revalidate: 3600 } });
  traces.push(drugs.trace);

  for (const r of drugs.data?.results ?? []) {
    const prod = r.products?.[0];
    hits.push({
      id: `drugsfda:${r.application_number || hits.length}`,
      brandName: prod?.brand_name || firstStr(r.openfda?.brand_name),
      genericName: firstStr(r.openfda?.generic_name),
      manufacturer: r.sponsor_name,
      dosageForm: prod?.dosage_form,
      route: prod?.route,
      description: r.application_number
        ? `Drugs@FDA application ${r.application_number}`
        : undefined,
      url: r.application_number
        ? `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${r.application_number.replace(
            /\D/g,
            ""
          )}`
        : "https://open.fda.gov/apis/drug/drugsfda/",
      source: "openfda-drugsfda",
    });
  }

  return { hits: hits.slice(0, 6), traces, query: q };
}
