"use client";

import { useMemo, useState } from "react";
import type { ReactionNetwork } from "@/lib/frontier/reactionNetwork";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  compareNetworkEdges,
  listComparableEdges,
  suggestEdgePairs,
} from "@/lib/frontier/edgeCompare";
import { buildEdgePairExperiments } from "@/lib/frontier/edgeExperiments";

/**
 * Side-by-side evidence for two network edges.
 */
export function NetworkEdgeComparePanel({
  network,
  dossiers = [],
}: {
  network: ReactionNetwork;
  dossiers?: LiveDossier[];
}) {
  const edges = useMemo(() => listComparableEdges(network, 30), [network]);
  const suggestions = useMemo(() => suggestEdgePairs(network, 5), [network]);
  const [idA, setIdA] = useState(edges[0]?.id || "");
  const [idB, setIdB] = useState(edges[1]?.id || edges[0]?.id || "");

  const result = useMemo(() => {
    if (!idA || !idB || idA === idB) return null;
    return compareNetworkEdges(network, idA, idB, dossiers);
  }, [network, idA, idB, dossiers]);

  const edgeExps = useMemo(
    () => buildEdgePairExperiments(network, dossiers, 5),
    [network, dossiers]
  );

  if (edges.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-[11px] text-slate-600">
        Need ≥2 network edges to compare evidence. Densify related entities first.
      </div>
    );
  }

  function label(id: string) {
    const e = edges.find((x) => x.id === id);
    if (!e) return id;
    return `${e.relation} · str ${e.strength}`;
  }

  return (
    <div
      id="edge-compare"
      className="scroll-mt-24 rounded-xl border border-orange-500/25 bg-orange-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-200/90">
        Frontier · edge evidence
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Compare two network edges
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Side-by-side free-public evidence on graph relations — not a route selection
        decision.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] font-semibold uppercase text-slate-500">
          Edge A
          <select
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            {edges.map((e) => (
              <option key={e.id} value={e.id}>
                {label(e.id)} · {e.id.slice(0, 12)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase text-slate-500">
          Edge B
          <select
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            {edges.map((e) => (
              <option key={e.id} value={e.id}>
                {label(e.id)} · {e.id.slice(0, 12)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={`${s.a}-${s.b}`}
              type="button"
              onClick={() => {
                setIdA(s.a);
                setIdB(s.b);
              }}
              className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:border-orange-500/40 hover:text-orange-100"
            >
              {s.reason}
            </button>
          ))}
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-300">{result.summary}</p>
          <ul className="text-[10px] text-slate-500">
            {result.overlapNotes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            {[result.edgeA, result.edgeB].map((row, i) => (
              <div
                key={row.edgeId}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-[11px]"
              >
                <div className="font-semibold text-slate-200">
                  {i === 0 ? "A" : "B"} · {row.relation}
                </div>
                <div className="mt-0.5 text-slate-400">
                  {row.fromLabel} → {row.toLabel}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-600">
                  strength {row.strength}
                  {row.pubchemCids.length
                    ? ` · CID ${row.pubchemCids.join(", ")}`
                    : ""}
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-slate-500">
                  {row.evidence.length ? (
                    row.evidence.map((e) => <li key={e}>{e}</li>)
                  ) : (
                    <li className="text-slate-600">No edge evidence strings</li>
                  )}
                </ul>
                {row.conditionSnippets.length > 0 ? (
                  <div className="mt-2 border-t border-slate-800 pt-2">
                    <div className="text-[9px] font-semibold uppercase text-slate-600">
                      Linked condition quotes
                    </div>
                    {row.conditionSnippets.map((s, j) => (
                      <p key={j} className="mt-1 text-[10px] italic text-slate-500">
                        [{s.kind}] {s.raw}: “{s.quote}”
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600">{result.disclaimer}</p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-600">Select two different edges.</p>
      )}

      {edgeExps.length > 0 ? (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Auto experiments from edge pairs
          </h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-400">
            {edgeExps.map((e) => (
              <li
                key={e.id}
                className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5"
              >
                <span
                  className={`mr-1.5 rounded px-1 text-[9px] font-bold uppercase ${
                    e.priority === "high"
                      ? "bg-rose-500/15 text-rose-100"
                      : e.priority === "medium"
                        ? "bg-amber-500/15 text-amber-100"
                        : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {e.priority}
                </span>
                {e.question}
                <span className="mt-0.5 block text-[10px] text-slate-600">
                  {e.gap}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
