"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearUserSupplementsForCid,
  getUserSupplementsForCid,
  saveUserSupplement,
} from "@/lib/idb/userSupplements";

/**
 * Paste public patent/paper text (local only) to densify process facts.
 */
export function LocalTextEnrich({
  cid,
  onSaved,
}: {
  cid: number;
  onSaved?: () => void;
}) {
  const [text, setText] = useState("");
  const [label, setLabel] = useState("Public patent example text");
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    setCount(getUserSupplementsForCid(cid).length);
  }, [cid]);

  useEffect(() => {
    reload();
  }, [reload]);

  function save() {
    const row = saveUserSupplement(cid, text, label);
    if (!row) {
      setMsg("Paste at least ~40 characters of public text.");
      return;
    }
    setMsg(
      `Saved ${row.text.length.toLocaleString()} chars locally. Facts re-extract on this device only.`
    );
    setText("");
    reload();
    onSaved?.();
  }

  function clear() {
    if (!confirm("Remove all local pasted text for this CID?")) return;
    clearUserSupplementsForCid(cid);
    setMsg("Local supplements cleared.");
    reload();
    onSaved?.();
  }

  return (
    <div
      id="local-text-enrich"
      className="print:hidden scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-slate-100">
        Local full-text enrich
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Paste <strong className="font-medium text-slate-400">public</strong> patent
        examples or paper experimental text. Stored only in this browser — improves
        condition density without inventing plant limits. Not for confidential
        site SOPs.
      </p>
      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Label
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
        />
      </label>
      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Public text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Example 1. A mixture was heated at 80 °C for 3 h under N2…"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          Save & re-extract facts
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-900"
        >
          Clear local pastes ({count})
        </button>
      </div>
      {msg ? <p className="mt-2 text-[11px] text-teal-300/90">{msg}</p> : null}
    </div>
  );
}
