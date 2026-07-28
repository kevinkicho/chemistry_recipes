"use client";

import { useMemo, useState } from "react";
import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import { ContentProvenance } from "@/components/ContentProvenance";
import { slimTraces } from "@/lib/api/trace";

const UNIT_OP_HINTS = [
  "crystalliz",
  "filtr",
  "distill",
  "extract",
  "hydrogenat",
  "hydrolysis",
  "coupling",
  "workup",
  "isolation",
  "chromatograph",
  "centrifug",
  "dry",
  "mill",
  "react",
  "ferment",
  "chromat",
];

/**
 * Search process facts + literature + patents by problem statement or unit-op keyword.
 * Free-text filter over public evidence only — no invented plant answers.
 */
export function ProblemUnitOpSearch({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | ProcessFact["kind"]>("all");

  const query = q.trim().toLowerCase();

  const matchedFacts = useMemo(() => {
    const facts = dossier.processFacts?.facts || [];
    return facts.filter((f) => {
      if (kind !== "all" && f.kind !== kind) return false;
      if (!query) return f.kind !== "open-gap";
      const hay = `${f.claim} ${f.quote || ""} ${f.sourceLabel || ""} ${f.kind}`.toLowerCase();
      return hay.includes(query);
    });
  }, [dossier.processFacts?.facts, query, kind]);

  const matchedLit = useMemo(() => {
    if (!query) return [];
    return (dossier.literature || [])
      .filter((h) => {
        const hay = `${h.title || ""} ${h.abstract || ""} ${h.journal || ""}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 8);
  }, [dossier.literature, query]);

  const matchedPatents = useMemo(() => {
    if (!query) return [];
    return (dossier.patents || [])
      .filter((h) => {
        const hay = `${h.title || ""} ${h.abstract || ""} ${h.patentNumber || ""} ${h.id || ""}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 8);
  }, [dossier.patents, query]);

  return (
    <div
      id="problem-unit-op-search"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">
          Problem / unit-op search
        </h2>
        <ContentProvenance
          title="Problem / unit-op search"
          field="Unit-op search"
          pubchemCid={dossier.cid}
          traces={slimTraces(dossier.traces || [])}
          sourceRefs={dossier.sourceRefs}
          ai={dossier.synthesis.provenance}
          showAi={Boolean(dossier.synthesis.provenance)}
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Filter public process facts, literature, and patents by a process problem or
        unit operation (e.g. crystallization, workup). Does not invent plant answers.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. crystallization · hydrogenation · impurity · filtration"
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="all">All fact kinds</option>
          <option value="unit-op">Unit op</option>
          <option value="condition">Condition</option>
          <option value="material">Material</option>
          <option value="isolation">Isolation</option>
          <option value="workup">Workup</option>
          <option value="yield">Yield</option>
          <option value="hazard-process">Hazard-process</option>
          <option value="open-gap">Open gap</option>
        </select>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {UNIT_OP_HINTS.slice(0, 10).map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => setQ(hint)}
            className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700 hover:text-teal-200"
          >
            {hint}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Facts ({matchedFacts.length}
            {query ? " match" : " shown"})
          </h3>
          {matchedFacts.length === 0 ? (
            <p className="mt-1 text-xs text-slate-600">
              {query
                ? "No facts match — try a broader unit-op or paste public procedure text."
                : "No process facts yet."}
            </p>
          ) : (
            <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto">
              {matchedFacts.slice(0, 24).map((f) => (
                <li
                  key={f.id}
                  className="rounded border border-slate-800/80 bg-slate-950/50 px-2 py-1.5 text-xs text-slate-300"
                >
                  <span className="mr-1.5 rounded bg-slate-800 px-1 py-0.5 text-[9px] uppercase text-slate-500">
                    {f.kind}
                  </span>
                  {f.claim}
                  {f.sourceUrl ? (
                    <a
                      href={f.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-[10px] text-teal-500/90 hover:underline"
                    >
                      {f.sourceLabel || f.sourceUrl}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {query ? (
          <>
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Literature ({matchedLit.length})
              </h3>
              <ul className="mt-1 space-y-1 text-xs text-slate-400">
                {matchedLit.map((h, i) => (
                  <li key={h.id || i}>
                    {h.url ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400/90 hover:underline"
                      >
                        {h.title || h.id}
                      </a>
                    ) : (
                      h.title || h.id
                    )}
                  </li>
                ))}
                {!matchedLit.length ? (
                  <li className="text-slate-600">No literature title/abstract match.</li>
                ) : null}
              </ul>
            </section>
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Patents ({matchedPatents.length})
              </h3>
              <ul className="mt-1 space-y-1 text-xs text-slate-400">
                {matchedPatents.map((h, i) => (
                  <li key={h.id || h.patentNumber || i}>
                    {h.url ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400/90 hover:underline"
                      >
                        {h.title || h.patentNumber}
                      </a>
                    ) : (
                      h.title || h.patentNumber
                    )}
                  </li>
                ))}
                {!matchedPatents.length ? (
                  <li className="text-slate-600">No patent title/abstract match.</li>
                ) : null}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
