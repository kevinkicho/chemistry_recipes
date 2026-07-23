/**
 * Warm IndexedDB cache by streaming a live dossier (client-side).
 */

import {
  putCachedDossierAndNotify,
  getCachedDossier,
} from "@/lib/idb/dossierCache";
import type { LiveDossier } from "@/lib/dossier/types";

/**
 * Load from cache or stream /api/dossier/[cid]/stream until complete.
 */
export async function warmLiveDossier(
  cid: number,
  opts?: { force?: boolean; onStatus?: (s: string) => void }
): Promise<LiveDossier | null> {
  if (!Number.isFinite(cid) || cid <= 0) return null;

  if (!opts?.force) {
    const cached = await getCachedDossier(cid);
    if (cached?.dossier) {
      opts?.onStatus?.(`Cache hit CID ${cid}`);
      return cached.dossier;
    }
  }

  opts?.onStatus?.(`Building CID ${cid}…`);
  const url = `/api/dossier/${cid}/stream`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok || !res.body) {
    opts?.onStatus?.(`Stream failed HTTP ${res.status}`);
    return null;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: LiveDossier | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const block of parts) {
      const dataLine = block
        .split("\n")
        .find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.replace(/^data:\s?/, "").trim();
      if (!json || json === "[DONE]") continue;
      try {
        const ev = JSON.parse(json) as {
          type?: string;
          dossier?: LiveDossier;
          label?: string;
        };
        if (ev.label) opts?.onStatus?.(ev.label);
        if (ev.dossier) {
          last = ev.dossier;
          if (ev.type === "complete" || ev.type === "partial") {
            // keep last; cache on complete only
            if (ev.type === "complete") {
              await putCachedDossierAndNotify(ev.dossier);
              opts?.onStatus?.(`Cached CID ${cid}`);
            }
          }
        }
      } catch {
        /* ignore partial SSE */
      }
    }
  }

  if (last && last.cid === cid) {
    // Ensure cache even if complete event lacked type
    await putCachedDossierAndNotify(last);
  }
  return last;
}
