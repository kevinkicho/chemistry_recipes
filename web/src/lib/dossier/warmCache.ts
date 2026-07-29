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
  opts?: {
    force?: boolean;
    onStatus?: (s: string) => void;
    /** Cancel stream read when user navigates away */
    signal?: AbortSignal;
  }
): Promise<LiveDossier | null> {
  if (!Number.isFinite(cid) || cid <= 0) return null;

  if (!opts?.force) {
    const cached = await getCachedDossier(cid);
    if (cached?.dossier) {
      opts?.onStatus?.(`Cache hit CID ${cid}`);
      return cached.dossier;
    }
  }

  if (opts?.signal?.aborted) {
    opts?.onStatus?.(`Aborted CID ${cid}`);
    return null;
  }

  opts?.onStatus?.(`Building CID ${cid}…`);
  const qs = opts?.force ? "?force=1" : "";
  const url = `/api/dossier/${cid}/stream${qs}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: opts?.signal });
  } catch {
    opts?.onStatus?.(
      opts?.signal?.aborted ? `Aborted CID ${cid}` : `Stream failed CID ${cid}`
    );
    return null;
  }
  if (!res.ok || !res.body) {
    opts?.onStatus?.(`Stream failed HTTP ${res.status}`);
    return null;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: LiveDossier | null = null;
  let completed = false;

  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  opts?.signal?.addEventListener("abort", onAbort);

  try {
    while (true) {
      if (opts?.signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        break;
      }
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
            if (ev.type === "complete") {
              completed = true;
              await putCachedDossierAndNotify(ev.dossier);
              opts?.onStatus?.(`Cached CID ${cid}`);
            }
          }
        } catch {
          /* ignore partial SSE */
        }
      }
    }
  } finally {
    opts?.signal?.removeEventListener("abort", onAbort);
  }

  if (opts?.signal?.aborted) {
    opts?.onStatus?.(`Aborted CID ${cid} (left page)`);
    // Only keep complete cache; do not promote partial shells as full cache
    return completed ? last : null;
  }

  if (last && last.cid === cid && !completed) {
    // Ensure cache even if complete event lacked type
    await putCachedDossierAndNotify(last);
  }
  return last;
}
