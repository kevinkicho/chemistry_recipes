"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearUserSupplementsForCid,
  getUserSupplementsForCid,
  saveUserSupplement,
} from "@/lib/idb/userSupplements";
import { addWorkPackPaste } from "@/lib/workspace/workPacks";

/**
 * Paste public patent/paper text (local only) to densify process facts.
 * Primary worker path when recipe readiness is still scout.
 */
export function LocalTextEnrich({
  cid,
  moleculeLabel,
  onSaved,
  emphasize,
}: {
  cid: number;
  moleculeLabel?: string;
  onSaved?: () => void;
  /** Highlight as primary CTA (scout mode) */
  emphasize?: boolean;
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
    addWorkPackPaste(cid, {
      label: label || "Public paste",
      text: row.text,
      moleculeLabel,
    });
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

  function onFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      setMsg(
        "PDF binary upload is not parsed in-browser yet — paste public text from the PDF, or save as .txt/.md and upload that."
      );
      return;
    }
    if (
      !name.endsWith(".txt") &&
      !name.endsWith(".md") &&
      !name.endsWith(".csv") &&
      !file.type.startsWith("text/")
    ) {
      setMsg("Use a public .txt / .md text file (or paste).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      if (raw.length < 40) {
        setMsg("File too short — need ~40+ characters of public procedure text.");
        return;
      }
      setText(raw.slice(0, 200_000));
      if (!label || label === "Public patent example text") {
        setLabel(`Public file: ${file.name}`);
      }
      setMsg(
        `Loaded ${raw.length.toLocaleString()} chars from ${file.name}. Review, then Save & re-extract.`
      );
    };
    reader.onerror = () => setMsg("Could not read file.");
    reader.readAsText(file);
  }

  return (
    <div
      id="local-text-enrich"
      className={`print:hidden scroll-mt-24 rounded-xl p-4 ${
        emphasize
          ? "border-2 border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-400/20"
          : "border border-slate-800 bg-slate-900/50"
      }`}
    >
      <h2 className="text-sm font-semibold text-slate-100">
        {emphasize ? "Primary path: densify with public procedure text" : "Local full-text enrich"}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Paste or load <strong className="font-medium text-slate-400">public</strong>{" "}
        patent examples / paper experimental text (.txt / .md). Stored only in this
        browser — densifies process facts for recipe-draft mode without inventing
        plant limits. Not for confidential site SOPs.
        {emphasize ? (
          <span className="mt-1 block font-medium text-amber-100/90">
            Free APIs alone are often thin — this is how workers get a useful job aid.
          </span>
        ) : null}
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
        Load public text file
        <input
          type="file"
          accept=".txt,.md,.csv,text/plain,text/markdown"
          className="mt-1 block w-full text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-xs file:text-slate-200"
          onChange={(e) => onFile(e.target.files)}
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
