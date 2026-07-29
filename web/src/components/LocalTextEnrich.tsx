"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearUserSupplementsForCid,
  getUserSupplementsForCid,
  saveUserSupplement,
} from "@/lib/idb/userSupplements";
import { addWorkPackPaste } from "@/lib/workspace/workPacks";
import { FreePublicBadge } from "@/components/FreePublicProvenance";
import { ApiProvenance } from "@/components/ApiProvenance";

type WizardStep = 1 | 2 | 3;

const SOURCE_PRESETS = [
  { id: "patent", label: "Public patent example" },
  { id: "paper", label: "OA paper experimental" },
  { id: "orgsyn", label: "Org. Syn. / procedure" },
  { id: "other", label: "Other public text" },
] as const;

/**
 * Paste wizard — public patent/paper text (local only) to densify process facts.
 * Primary worker path when recipe readiness is still scout.
 */
export function LocalTextEnrich({
  cid,
  moleculeLabel,
  onSaved,
  emphasize,
  idealScoreBefore,
  processFactCountBefore,
}: {
  cid: number;
  moleculeLabel?: string;
  onSaved?: (info?: {
    chars: number;
    idealScoreBefore?: number;
    processFactCountBefore?: number;
  }) => void;
  /** Highlight as primary CTA (scout mode) */
  emphasize?: boolean;
  /** Ideal page score before this paste (for delta feedback) */
  idealScoreBefore?: number;
  processFactCountBefore?: number;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [sourceKind, setSourceKind] = useState<(typeof SOURCE_PRESETS)[number]["id"]>("patent");
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
      setStep(2);
      return;
    }
    addWorkPackPaste(cid, {
      label: label || "Public paste",
      text: row.text,
      moleculeLabel,
    });
    setMsg(
      `Saved ${row.text.length.toLocaleString()} chars locally (${sourceKind}). Re-extracting facts… Ideal was ${idealScoreBefore ?? "—"}/100 · facts ${processFactCountBefore ?? "—"}.`
    );
    setText("");
    setStep(1);
    reload();
    onSaved?.({
      chars: row.text.length,
      idealScoreBefore,
      processFactCountBefore,
    });
  }

  function applySourcePreset(id: (typeof SOURCE_PRESETS)[number]["id"]) {
    setSourceKind(id);
    const preset = SOURCE_PRESETS.find((p) => p.id === id);
    if (preset) setLabel(preset.label);
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
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">
          {emphasize
            ? "Paste wizard · densify with public procedure text"
            : "Paste wizard · local full-text enrich"}
        </h2>
        <ApiProvenance
          pubchemCid={cid}
          title="Local public-text enrich"
          label="API"
        />
        <FreePublicBadge note="local public paste · not AI invention · not GMP" />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Step-through wizard for <strong className="font-medium text-slate-400">public</strong>{" "}
        patent / paper experimental text (.txt / .md). Stored only in this browser —
        densifies process facts without inventing plant limits. Not for confidential
        site SOPs.
        {emphasize ? (
          <span className="mt-1 block font-medium text-amber-100/90">
            Free APIs alone are often thin — this is how workers get a useful job aid.
          </span>
        ) : null}
      </p>

      <ol className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
        {(
          [
            [1, "Source type"],
            [2, "Paste / load"],
            [3, "Review & save"],
          ] as const
        ).map(([n, lab]) => (
          <li
            key={n}
            className={`rounded-full px-2.5 py-0.5 ring-1 ring-inset ${
              step === n
                ? "bg-teal-500/20 text-teal-100 ring-teal-400/40"
                : step > n
                  ? "bg-slate-800 text-slate-400 ring-slate-700"
                  : "bg-slate-950 text-slate-600 ring-slate-800"
            }`}
          >
            {n}. {lab}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-500">
            What kind of free-public text are you adding?
          </p>
          <div className="flex flex-wrap gap-2">
            {SOURCE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applySourcePreset(p.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  sourceKind === p.id
                    ? "border-teal-500/50 bg-teal-500/10 text-teal-100"
                    : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
          >
            Next · paste text
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Load public text file
            <input
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown"
              className="mt-1 block w-full text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-xs file:text-slate-200"
              onChange={(e) => onFile(e.target.files)}
            />
          </label>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Public text
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Example 1. A mixture was heated at 80 °C for 3 h under N2…"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
            />
          </label>
          <p className="text-[10px] text-slate-600">
            {text.length.toLocaleString()} chars
            {text.length >= 40 ? " · ready for review" : " · need ~40+"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400"
            >
              Back
            </button>
            <button
              type="button"
              disabled={text.trim().length < 40}
              onClick={() => setStep(3)}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
            >
              Next · review
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-400">
            Confirm this is <strong className="text-slate-300">public</strong> text only
            (not confidential SOPs). Label:{" "}
            <span className="font-medium text-slate-200">{label}</span> ·{" "}
            {text.length.toLocaleString()} chars · kind {sourceKind}.
          </p>
          <pre className="max-h-32 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] text-slate-500 whitespace-pre-wrap">
            {text.slice(0, 1200)}
            {text.length > 1200 ? "\n…" : ""}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400"
            >
              Back
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
            >
              Save & re-extract facts
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
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
