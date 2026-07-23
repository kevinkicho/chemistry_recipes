"use client";

import { useEffect, useState } from "react";
import { fetchServerAiStatus } from "@/lib/ai/client";

/**
 * Dev/env readiness checklist for free APIs + Ollama (no secrets shown).
 */
export function EnvChecklist() {
  const [envKey, setEnvKey] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>("");
  const [host, setHost] = useState<string>("");

  useEffect(() => {
    void fetchServerAiStatus().then((s) => {
      if (!s) {
        setEnvKey(false);
        return;
      }
      setEnvKey(s.envKeyConfigured);
      setModel(s.model);
      setHost(s.host);
    });
  }, []);

  const rows: Array<{ ok: boolean | null; label: string; hint: string }> = [
    {
      ok: envKey,
      label: "OLLAMA_CLOUD_API_KEY",
      hint: envKey ? "Server key configured" : "Set in repo-root .env for synthesis",
    },
    {
      ok: true,
      label: "PubChem / Europe PMC / OpenAlex",
      hint: "Free public HTTP — no keys required",
    },
    {
      ok: null,
      label: "PATENTSVIEW_API_KEY",
      hint: "Optional USPTO PatentsView key for richer patent hits",
    },
    {
      ok: Boolean(model),
      label: "Ollama model",
      hint: model || "Default gpt-oss:120b · optional OLLAMA_CLOUD_FAST_MODEL",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Environment checklist
      </div>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
        {rows.map((r) => (
          <li key={r.label} className="flex gap-2">
            <span
              className={
                r.ok === true
                  ? "text-emerald-400"
                  : r.ok === false
                    ? "text-rose-400"
                    : "text-slate-600"
              }
            >
              {r.ok === true ? "✓" : r.ok === false ? "!" : "·"}
            </span>
            <span>
              <span className="font-mono text-slate-300">{r.label}</span>
              <span className="mt-0.5 block text-[11px] text-slate-600">{r.hint}</span>
            </span>
          </li>
        ))}
      </ul>
      {host ? (
        <p className="mt-2 font-mono text-[10px] text-slate-600">Host {host}</p>
      ) : null}
    </div>
  );
}
