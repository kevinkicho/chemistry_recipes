/**
 * ORD offline / bulk ingest hooks — local pointers + optional JSON paste index.
 * Does not download multi-GB datasets automatically (user-controlled).
 */

const KEY = "cr-ord-bulk-index-v1";

export const ORD_BULK = {
  datasetUrl: "https://github.com/open-reaction-database/ord-data",
  docsUrl: "https://docs.open-reaction-database.org/",
  browseBase: "https://open-reaction-database.org/client/browse",
  note:
    "ORD bulk protobuf/JSON is free for offline reaction indexing. " +
    "This app stores only user-selected local index snippets — not plant SOPs.",
} as const;

export interface OrdBulkSnippet {
  id: string;
  query: string;
  text: string;
  sourceUrl?: string;
  savedAt: string;
  chars: number;
}

function canUse(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function read(): OrdBulkSnippet[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as OrdBulkSnippet[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function write(rows: OrdBulkSnippet[]): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 60)));
}

export function listOrdBulkSnippets(query?: string): OrdBulkSnippet[] {
  const all = read();
  if (!query?.trim()) return all;
  const q = query.toLowerCase();
  return all.filter(
    (s) => s.query.toLowerCase().includes(q) || s.text.toLowerCase().includes(q)
  );
}

export function saveOrdBulkSnippet(opts: {
  query: string;
  text: string;
  sourceUrl?: string;
}): OrdBulkSnippet | null {
  const text = opts.text.trim();
  if (text.length < 40) return null;
  const row: OrdBulkSnippet = {
    id: `ord_${Date.now().toString(36)}`,
    query: opts.query.trim() || "ORD",
    text: text.slice(0, 50_000),
    sourceUrl: opts.sourceUrl || ORD_BULK.datasetUrl,
    savedAt: new Date().toISOString(),
    chars: Math.min(text.length, 50_000),
  };
  write([row, ...read()]);
  return row;
}

export function clearOrdBulkSnippets(): void {
  write([]);
}

export function ordBrowseUrl(component: string): string {
  return `${ORD_BULK.browseBase}?component=${encodeURIComponent(component)}`;
}
