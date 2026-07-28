"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  cidsDueForDensify,
  listDensifySchedule,
  markDensifyWarmed,
  type DensifyScheduleEntry,
} from "@/lib/dossier/densifySchedule";
import { warmLiveDossier } from "@/lib/dossier/warmCache";
import { routes } from "@/lib/routes";

/**
 * Client densify schedule — recently viewed thin CIDs + warm-now actions.
 */
export function DensifySchedulePanel() {
  const [entries, setEntries] = useState<DensifyScheduleEntry[]>([]);
  const [due, setDue] = useState<DensifyScheduleEntry[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const reload = useCallback(() => {
    setEntries(listDensifySchedule().slice(0, 12));
    setDue(cidsDueForDensify().slice(0, 6));
  }, []);

  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener("cr-densify-schedule-changed", on);
    return () => window.removeEventListener("cr-densify-schedule-changed", on);
  }, [reload]);

  async function warmOne(cid: number) {
    setBusy(cid);
    setStatus(`Warming CID ${cid}…`);
    try {
      await warmLiveDossier(cid, {
        force: true,
        onStatus: (s) => setStatus(s),
      });
      markDensifyWarmed(cid);
      setStatus(`Warm complete for CID ${cid}`);
      reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Warm failed");
    } finally {
      setBusy(null);
    }
  }

  if (!entries.length) return null;

  return (
    <div
      id="densify-schedule"
      className="print:hidden scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-sm font-semibold text-slate-100">Densify schedule (local)</h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Recently viewed CIDs — warm thin ones in the background so Monday opens dense.
        Client-only; no server cron.
      </p>
      {due.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
            Due for densify
          </p>
          <ul className="mt-1 space-y-1">
            {due.map((e) => (
              <li
                key={e.cid}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-xs"
              >
                <Link href={routes.pubchem(e.cid)} className="text-teal-300 hover:underline">
                  {e.label || `CID ${e.cid}`}
                </Link>
                <button
                  type="button"
                  disabled={busy === e.cid}
                  onClick={() => void warmOne(e.cid)}
                  className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 enabled:hover:border-teal-500/40 disabled:opacity-40"
                >
                  {busy === e.cid ? "Warming…" : "Warm now"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-[11px] text-slate-500">
        {entries.map((e) => (
          <li key={e.cid} className="flex justify-between gap-2">
            <Link href={routes.pubchem(e.cid)} className="text-slate-400 hover:text-teal-300">
              {e.label || `CID ${e.cid}`}
            </Link>
            <span className="font-mono text-slate-600">
              p{e.priority} · score {e.evidenceScore ?? "—"}
            </span>
          </li>
        ))}
      </ul>
      {status ? (
        <p className="mt-2 text-[11px] text-slate-500" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
