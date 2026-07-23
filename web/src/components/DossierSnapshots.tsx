"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  getDossierSnapshot,
  listDossierSnapshots,
  type DossierSnapshotRecord,
} from "@/lib/idb/dossierSnapshots";
import { formatCacheAge } from "@/lib/idb/dossierCache";
import { Tooltip } from "@/components/Tooltip";

/**
 * List prior builds for this CID; restore a snapshot into the parent view.
 */
export function DossierSnapshots({
  cid,
  onRestore,
  refreshKey = 0,
}: {
  cid: number;
  onRestore: (dossier: LiveDossier) => void;
  /** Bump after a new build completes */
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<DossierSnapshotRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listDossierSnapshots(cid);
    setRows(list);
    setLoading(false);
  }, [cid]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && rows.length === 0) {
    return (
      <p className="print:hidden text-[11px] text-slate-600">Loading versions…</p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="print:hidden text-[11px] text-slate-600">
        No prior versions yet — each completed build is snapshotted here.
      </p>
    );
  }

  return (
    <div className="print:hidden rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Version history (this browser)
      </div>
      <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"
          >
            <span>
              {formatCacheAge(r.savedAt)}
              {r.buildMode ? ` · ${r.buildMode}` : ""}
              {r.evidenceScore != null ? ` · score ${r.evidenceScore}` : ""}
              {r.model ? ` · ${r.model}` : ""}
            </span>
            <Tooltip content="Restore this snapshot in the current view (does not re-run APIs)">
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-teal-300 hover:border-teal-500/40"
                onClick={async () => {
                  const full = await getDossierSnapshot(r.id);
                  if (full?.dossier) onRestore(full.dossier);
                }}
              >
                Restore
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </div>
  );
}
