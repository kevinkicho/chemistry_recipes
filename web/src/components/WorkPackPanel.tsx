"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addWorkPackNote,
  ensureWorkPack,
  getWorkPackForCid,
  subscribeWorkPacks,
  type WorkPack,
} from "@/lib/workspace/workPacks";
import { routes } from "@/lib/routes";
import Link from "next/link";

/**
 * Local work pack: sticky notes + paste history for this CID.
 */
export function WorkPackPanel({
  cid,
  label,
}: {
  cid: number;
  label: string;
}) {
  const [pack, setPack] = useState<WorkPack | null>(null);
  const [note, setNote] = useState("");

  const reload = useCallback(() => {
    setPack(getWorkPackForCid(cid) || ensureWorkPack(cid, label));
  }, [cid, label]);

  useEffect(() => {
    reload();
    return subscribeWorkPacks(reload);
  }, [reload]);

  function saveNote() {
    if (!note.trim()) return;
    addWorkPackNote(cid, note, label);
    setNote("");
    reload();
  }

  return (
    <div
      id="work-pack"
      className="print:hidden scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Work pack (local)</h2>
        <Link
          href={routes.workspace()}
          className="text-[11px] font-medium text-teal-400 hover:underline"
        >
          All workspace projects →
        </Link>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Sticky notes and paste history for this molecule on this device — for shift / scouting
        continuity.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a scouting note…"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") saveNote();
          }}
        />
        <button
          type="button"
          onClick={saveNote}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
        >
          Add
        </button>
      </div>

      {pack?.notes?.length ? (
        <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
          {pack.notes.slice(0, 12).map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 text-xs text-slate-300"
            >
              <span className="text-[10px] text-slate-600">
                {new Date(n.createdAt).toLocaleString()}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{n.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-600">No notes yet.</p>
      )}

      {pack?.pastes?.length ? (
        <div className="mt-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Paste history
          </h3>
          <ul className="mt-1 space-y-1">
            {pack.pastes.slice(0, 8).map((p) => (
              <li key={p.id} className="text-[11px] text-slate-500">
                <span className="font-medium text-slate-400">{p.label}</span>
                {" · "}
                {p.chars.toLocaleString()} chars ·{" "}
                {new Date(p.createdAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
