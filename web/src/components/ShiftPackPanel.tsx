"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  buildShiftPackFromDossier,
  deleteShiftPack,
  downloadShiftPackJson,
  listShiftPacksForCid,
  saveShiftPack,
  shiftPackManifestText,
  type ShiftPackSnapshot,
} from "@/lib/workspace/shiftPacks";
import { ContentProvenance } from "@/components/ContentProvenance";
import { slimTraces } from "@/lib/api/trace";

/**
 * One local shift-pack artifact: save / list / JSON / copy / print.
 */
export function ShiftPackPanel({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const [rows, setRows] = useState<ShiftPackSnapshot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    setRows(listShiftPacksForCid(dossier.cid));
  }, [dossier.cid]);

  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener("cr-shift-packs-changed", on);
    return () => window.removeEventListener("cr-shift-packs-changed", on);
  }, [reload]);

  function saveNow() {
    const pack = saveShiftPack(buildShiftPackFromDossier(dossier));
    setMsg(`Saved shift pack ${pack.id} · ${pack.steps.length} steps`);
    reload();
  }

  return (
    <div
      id="shift-pack"
      className="print:hidden scroll-mt-24 rounded-xl border border-teal-500/25 bg-teal-500/5 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Shift pack (local)</h2>
        <ContentProvenance
          title="Shift pack"
          field="Shift pack"
          pubchemCid={dossier.cid}
          traces={slimTraces(dossier.traces || [])}
          sourceRefs={dossier.sourceRefs}
          ai={dossier.synthesis.provenance}
          showAi={Boolean(dossier.synthesis.provenance)}
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        One handoff artifact: EHS, steps, gaps, site-fill, notes. Browser only — not a batch
        record.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveNow}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          Save shift pack now
        </button>
        <button
          type="button"
          onClick={() => {
            document.getElementById("monday-pack")?.scrollIntoView({ block: "start" });
            window.setTimeout(() => window.print(), 200);
          }}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-teal-500/40"
        >
          Print floor pack
        </button>
      </div>
      {msg ? <p className="mt-2 text-[11px] text-teal-300/90">{msg}</p> : null}
      {rows.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-slate-500">{r.savedAt}</span>
                <span>
                  {r.steps.length} steps · score {r.evidenceScore ?? "—"} · pastes{" "}
                  {r.pasteCount}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => downloadShiftPackJson(r)}
                  className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-teal-300"
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(shiftPackManifestText(r));
                    setMsg("Manifest copied");
                  }}
                  className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                >
                  Copy text
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteShiftPack(r.id);
                    reload();
                  }}
                  className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-rose-300/90"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-600">No saved shift packs for this CID yet.</p>
      )}
    </div>
  );
}
