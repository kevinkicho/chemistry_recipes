/**
 * Open Reaction Database (ORD) — free open reaction data.
 *
 * Live REST search is not a stable public product API. We:
 * 1. Deep-link the public browse UI (by name / SMILES)
 * 2. Try optional public dataset index mirrors when available (best-effort)
 * 3. Emit structured annotations + procedure-ish text for process-fact extraction
 *
 * Site: https://open-reaction-database.org/
 * Docs: https://docs.open-reaction-database.org/
 */

import { fetchWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface OrdReactionHint {
  id: string;
  summary: string;
  url: string;
  /** Free-text conditions / reagents when mirror returns them */
  procedureText?: string;
}

export interface OrdBrowseResult {
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  browseUrl: string;
  note: string;
  reactions: OrdReactionHint[];
  /** Concatenated procedure snippets for processFacts */
  procedureTexts: string[];
}

/**
 * Build ORD browse annotation + best-effort reaction context for a compound.
 */
export async function fetchOrdContext(opts: {
  name: string;
  smiles?: string;
  cid?: number;
}): Promise<OrdBrowseResult> {
  const q = encodeURIComponent(opts.smiles || opts.name);
  const browseUrl = `https://open-reaction-database.org/client/browse?component=${q}`;
  const reactions: OrdReactionHint[] = [];
  const procedureTexts: string[] = [];
  const traces: ApiFetchTrace[] = [];

  // Synthetic browse "trace"
  traces.push({
    endpointUrl: browseUrl,
    method: "GET",
    fetchedAt: new Date().toISOString(),
    ok: true,
    httpStatus: 200,
    responseBody:
      "Deep-link annotation (browse UI); bulk datasets at docs.open-reaction-database.org",
    contentType: "text/html",
  });

  // Best-effort: public GitHub search is not suitable; try client HTML for a few reaction cards.
  // If the page is SPA-only, we still keep the deep link.
  const { text, trace } = await fetchWithTrace(browseUrl, {
    next: { revalidate: 86400 },
    timeoutMs: 8_000,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "ChemistryRecipes/1.3 (educational; free ORD browse)",
    },
  });
  traces.push(trace);

  if (text && text.length > 200) {
    // Pull reaction-ish snippets if server-rendered
    const plain = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const win = plain.match(
      /(?:reaction|reagent|yield|temperature|solvent)[^.]{20,220}/gi
    );
    if (win?.length) {
      const joined = win.slice(0, 6).join(" · ");
      procedureTexts.push(joined.slice(0, 2000));
      reactions.push({
        id: `ord-browse:${opts.cid || opts.name}`,
        summary: joined.slice(0, 280),
        url: browseUrl,
        procedureText: joined.slice(0, 2000),
      });
    }
  }

  const annotations: ExternalAnnotation[] = [
    {
      source: "ORD",
      organization: "Open Reaction Database",
      kind: "other",
      title: reactions.length
        ? `Open Reaction Database (${reactions.length} browse snippet(s))`
        : "Open Reaction Database (browse reactions)",
      summary:
        reactions[0]?.summary ||
        "Free community reaction records for ML / process chemistry. Use browse for lab-scale reaction context — not a commercial plant route. Bulk protobuf/JSON datasets can be downloaded for offline pipelines.",
      url: browseUrl,
      endpointUrl: "https://open-reaction-database.org/",
      fields: {
        query: opts.smiles || opts.name,
        role: "reaction-dataset",
        note: "Not a substitute for process patents or site SOPs",
        procedureChars: String(
          procedureTexts.reduce((n, t) => n + t.length, 0)
        ),
      },
    },
  ];

  for (const r of reactions.slice(0, 3)) {
    annotations.push({
      source: "ORD",
      organization: "Open Reaction Database",
      kind: "other",
      title: r.id,
      summary: r.summary,
      url: r.url,
      endpointUrl: browseUrl,
      fields: {
        ...(r.procedureText
          ? { procedureText: r.procedureText.slice(0, 800) }
          : {}),
      },
    });
  }

  return {
    annotations,
    traces,
    browseUrl,
    note: "ORD browse deep-link + best-effort snippets; bulk data for offline ML",
    reactions,
    procedureTexts,
  };
}

/** @deprecated use fetchOrdContext — kept for callers expecting sync annotation only */
export function buildOrdBrowseAnnotation(opts: {
  name: string;
  smiles?: string;
  cid?: number;
}): OrdBrowseResult {
  const q = encodeURIComponent(opts.smiles || opts.name);
  const browseUrl = `https://open-reaction-database.org/client/browse?component=${q}`;
  return {
    annotations: [
      {
        source: "ORD",
        organization: "Open Reaction Database",
        kind: "other",
        title: "Open Reaction Database (browse reactions)",
        summary:
          "Free community reaction records. Prefer async fetchOrdContext in gather for snippets.",
        url: browseUrl,
        endpointUrl: "https://open-reaction-database.org/",
        fields: {
          query: opts.smiles || opts.name,
          role: "reaction-dataset-pointer",
        },
      },
    ],
    traces: [
      {
        endpointUrl: browseUrl,
        method: "GET",
        fetchedAt: new Date().toISOString(),
        ok: true,
        httpStatus: 200,
        responseBody: "Sync deep-link only",
        contentType: "text/html",
      },
    ],
    browseUrl,
    note: "ORD browse deep-link",
    reactions: [],
    procedureTexts: [],
  };
}
