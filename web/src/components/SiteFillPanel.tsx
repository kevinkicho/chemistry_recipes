"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSiteFill,
  getSiteFill,
  saveSiteFill,
  subscribeSiteFill,
  type SiteFillRecord,
} from "@/lib/idb/siteFill";

/**
 * Site-fill blanks — empty on purpose; sticky locally under QMS ownership.
 */
export function SiteFillPanel({ cid, name }: { cid: number; name?: string }) {
  const [row, setRow] = useState<SiteFillRecord | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    setRow(getSiteFill(cid));
  }, [cid]);

  useEffect(() => {
    reload();
    return subscribeSiteFill(reload);
  }, [reload]);

  function field(
    key: keyof Omit<SiteFillRecord, "cid" | "updatedAt">,
    label: string,
    placeholder: string
  ) {
    const value = (row?.[key] as string | undefined) || "";
    return (
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        <input
          value={value}
          onChange={(e) => {
            const next = saveSiteFill(cid, { [key]: e.target.value });
            setRow(next);
            setMsg("Saved locally on this device.");
          }}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-100 placeholder:text-slate-600"
        />
      </label>
    );
  }

  return (
    <div
      id="site-fill"
      className="print:hidden scroll-mt-24 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"
    >
      <h2 className="text-sm font-semibold text-slate-100">Site fill (local only)</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Empty by design — your plant owns validated ranges. Stored only in this browser for{" "}
        {name || `CID ${cid}`}. Not synced. Not GMP.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {field("siteTemp", "Site temperature envelope", "e.g. site-validated °C range")}
        {field("siteTime", "Site time / cycle", "e.g. site hold / reaction time")}
        {field("sitePressure", "Site pressure", "e.g. site bar / psig")}
        {field("equipmentTag", "Equipment tag", "e.g. R-2401 GLR")}
        {field("ipcMethod", "Site IPC method", "e.g. HPLC-IPC-12 (site ID)")}
        {field("batchSize", "Batch / campaign size", "e.g. pilot 50 L")}
      </div>
      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Shift / transfer notes
        <textarea
          value={row?.notes || ""}
          onChange={(e) => {
            const next = saveSiteFill(cid, { notes: e.target.value });
            setRow(next);
            setMsg("Saved locally on this device.");
          }}
          rows={3}
          placeholder="Handover notes, open deviations to check, …"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-100"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            clearSiteFill(cid);
            setRow(null);
            setMsg("Site fill cleared for this CID.");
          }}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-900"
        >
          Clear site fill
        </button>
        {row?.updatedAt ? (
          <span className="self-center text-[10px] text-slate-600">
            Updated {new Date(row.updatedAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      {msg ? <p className="mt-2 text-[11px] text-violet-200/90">{msg}</p> : null}
    </div>
  );
}
