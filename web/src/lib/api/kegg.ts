/**
 * KEGG REST — free compound / reaction / pathway links (biosynthetic context).
 * Docs: https://www.kegg.jp/kegg/rest/keggapi.html
 * Text responses are plain text, not JSON.
 */

import { truncateResponse, type ApiFetchTrace } from "@/lib/api/trace";

const KEGG = "https://rest.kegg.jp";

export interface KeggCompound {
  id: string;
  name: string;
  formula?: string;
  pathways: Array<{ id: string; name: string }>;
  reactions: string[];
  /** Equation strings from KEGG rn: entries when fetched */
  reactionEquations?: string[];
  url: string;
}

async function fetchText(
  url: string
): Promise<{ text: string; trace: ApiFetchTrace }> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "text/plain" },
    });
    const text = await res.text();
    return {
      text,
      trace: {
        endpointUrl: url,
        method: "GET",
        fetchedAt,
        httpStatus: res.status,
        responseBody: truncateResponse(text, 1200),
        contentType: res.headers.get("content-type") || undefined,
        ok: res.ok,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      },
    };
  } catch (e) {
    return {
      text: "",
      trace: {
        endpointUrl: url,
        method: "GET",
        fetchedAt,
        responseBody: "",
        ok: false,
        error: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

/**
 * Find KEGG compound by name and list related pathways / reactions.
 */
export async function fetchKeggByName(
  name: string
): Promise<{ hit: KeggCompound | null; traces: ApiFetchTrace[]; query: string }> {
  const q = name.trim();
  if (!q) return { hit: null, traces: [], query: "" };

  const traces: ApiFetchTrace[] = [];
  const findUrl = `${KEGG}/find/compound/${encodeURIComponent(q)}`;
  const found = await fetchText(findUrl);
  traces.push(found.trace);

  // Lines: "cpd:C00031\tD-Glucose; ..."
  const line = found.text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("cpd:"));
  if (!line) return { hit: null, traces, query: q };

  const [idPart, namePart] = line.split("\t");
  const id = idPart.replace(/^cpd:/, "");
  const displayName = (namePart || q).split(";")[0]?.trim() || q;

  const getUrl = `${KEGG}/get/cpd:${id}`;
  const detail = await fetchText(getUrl);
  traces.push(detail.trace);

  let formula: string | undefined;
  const pathways: Array<{ id: string; name: string }> = [];
  const reactions: string[] = [];

  for (const raw of detail.text.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("FORMULA")) {
      formula = line.replace(/^FORMULA\s+/, "").trim();
    }
    if (line.startsWith("PATHWAY") || /^\s+map\d+/.test(line)) {
      const m = line.match(/(map\d+)\s+(.+)/);
      if (m) pathways.push({ id: m[1], name: m[2].trim() });
    }
    if (line.startsWith("REACTION") || /^\s+R\d+/.test(line)) {
      const ids = line.match(/R\d+/g);
      if (ids) reactions.push(...ids);
    }
  }

  const reactionIds = [...new Set(reactions)].slice(0, 12);

  // Fetch a few reaction equations for process / pathway context
  const reactionEquations: string[] = [];
  for (const rid of reactionIds.slice(0, 4)) {
    const rUrl = `${KEGG}/get/rn:${rid}`;
    const rDetail = await fetchText(rUrl);
    traces.push(rDetail.trace);
    if (!rDetail.trace.ok || !rDetail.text) continue;
    let equation: string | undefined;
    let definition: string | undefined;
    for (const raw of rDetail.text.split("\n")) {
      if (raw.startsWith("EQUATION")) {
        equation = raw.replace(/^EQUATION\s+/, "").trim();
      }
      if (raw.startsWith("DEFINITION")) {
        definition = raw.replace(/^DEFINITION\s+/, "").trim();
      }
    }
    const line = [rid, equation || definition].filter(Boolean).join(": ");
    if (line.length > 4) reactionEquations.push(line);
  }

  return {
    hit: {
      id,
      name: displayName,
      formula,
      pathways: pathways.slice(0, 8),
      reactions: reactionIds,
      reactionEquations,
      url: `https://www.kegg.jp/entry/${id}`,
    },
    traces,
    query: q,
  };
}
