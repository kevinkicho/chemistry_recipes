"use client";

import Link from "next/link";
import type { LiveDossier } from "@/lib/dossier/types";
import { routes } from "@/lib/routes";
import {
  FreePublicBadge,
  FreePublicProvenance,
} from "@/components/FreePublicProvenance";
import {
  formatProcessFactsEmptyCopy,
  honestMsatCompareHint,
  honestMsatCompareLitPatent,
} from "@/lib/dossier/sectionHonesty";

function sideMetrics(d: LiveDossier | null) {
  if (!d) return null;
  const facts = d.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ?? 0;
  const conditions = d.processFacts?.sourcedConditionCount ?? 0;
  const unitOps = d.processFacts?.unitOpCount ?? 0;
  const ehs = (d.hazards.hazardStatements || []).length;
  const harvestFail =
    formatProcessFactsEmptyCopy({
      traces: d.traces,
      fetchErrors: d.fetchErrors,
    }).kind === "error";
  const litPatent = honestMsatCompareLitPatent({
    literatureCount: d.literature?.length ?? 0,
    patentCount: d.patents?.length ?? 0,
    traces: d.traces,
    fetchErrors: d.fetchErrors,
  }).value;
  return {
    name: d.identity?.name || `CID ${d.cid}`,
    cid: d.cid,
    score: d.evidenceScore?.score ?? null,
    mode: d.productMode || d.recipeReadiness?.mode || "—",
    framing: d.processFraming || "—",
    facts,
    conditions,
    unitOps,
    lit: d.literature?.length ?? 0,
    patents: d.patents?.length ?? 0,
    ehs,
    routes: d.processRoutes?.length ?? 0,
    accuracy: d.processFacts?.metrics?.accuracyScore ?? null,
    ai: d.synthesis.parsed ? d.synthesis.model || "AI" : "shell",
    href: routes.pubchem(d.cid),
    harvestFail,
    litPatent,
  };
}

function pickHint(a: ReturnType<typeof sideMetrics>, b: ReturnType<typeof sideMetrics>) {
  // Harvest failure is not "Similar public density" / a clean 0/0 miss.
  // Leftover identity HTTP is not an MSAT-compare miss.
  return honestMsatCompareHint({ a, b });
}

/**
 * MSAT route-pick board for two live dossiers.
 */
export function CompareMsatBoard({
  a,
  b,
}: {
  a: LiveDossier | null;
  b: LiveDossier | null;
}) {
  const ma = sideMetrics(a);
  const mb = sideMetrics(b);
  const rows: Array<{ key: string; label: string; va: string; vb: string }> = [
    {
      key: "score",
      label: "Evidence score",
      va: ma?.score != null ? `${ma.score}/100` : "—",
      vb: mb?.score != null ? `${mb.score}/100` : "—",
    },
    {
      key: "mode",
      label: "Product mode",
      va: String(ma?.mode ?? "—"),
      vb: String(mb?.mode ?? "—"),
    },
    {
      key: "facts",
      label: "Process facts",
      va: ma ? String(ma.facts) : "—",
      vb: mb ? String(mb.facts) : "—",
    },
    {
      key: "cond",
      label: "Sourced conditions",
      va: ma ? String(ma.conditions) : "—",
      vb: mb ? String(mb.conditions) : "—",
    },
    {
      key: "uo",
      label: "Unit ops",
      va: ma ? String(ma.unitOps) : "—",
      vb: mb ? String(mb.unitOps) : "—",
    },
    {
      key: "lit",
      label: "Literature / patents",
      va: ma ? ma.litPatent : "—",
      vb: mb ? mb.litPatent : "—",
    },
    {
      key: "ehs",
      label: "GHS statements",
      va: ma ? String(ma.ehs) : "—",
      vb: mb ? String(mb.ehs) : "—",
    },
    {
      key: "acc",
      label: "Fact accuracy",
      va: ma?.accuracy != null ? `${ma.accuracy}/100` : "—",
      vb: mb?.accuracy != null ? `${mb.accuracy}/100` : "—",
    },
    {
      key: "ai",
      label: "AI / shell",
      va: ma?.ai ?? "—",
      vb: mb?.ai ?? "—",
    },
  ];

  return (
    <div
      id="compare-msat-board"
      className="mt-8 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-50">MSAT route-pick board</h2>
        {a ? (
          /* Composite all-traces hydration. Empty traces must not
             live-fetch leftover PubChem identity HTTP labeled as
             MSAT compare. */
          <FreePublicProvenance
            dossier={a}
            title="MSAT compare A"
            field="MSAT compare"
            liveFetch={false}
          />
        ) : null}
        {b ? (
          <FreePublicProvenance
            dossier={b}
            title="MSAT compare B"
            field="MSAT compare"
            liveFetch={false}
          />
        ) : (
          <FreePublicBadge note="free-public density · not GMP selection" />
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Side-by-side free-public density for tech transfer scouting — not a site process
        selection or GMP preference.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-sky-100/90">{pickHint(ma, mb)}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Metric</th>
              <th className="px-2 py-1.5">
                {ma ? (
                  <Link href={ma.href} className="text-teal-300 hover:underline">
                    A · {ma.name}
                  </Link>
                ) : (
                  "A"
                )}
              </th>
              <th className="px-2 py-1.5">
                {mb ? (
                  <Link href={mb.href} className="text-teal-300 hover:underline">
                    B · {mb.name}
                  </Link>
                ) : (
                  "B"
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-2 py-1.5 text-slate-500">{r.label}</td>
                <td className="px-2 py-1.5 font-medium text-slate-200">{r.va}</td>
                <td className="px-2 py-1.5 font-medium text-slate-200">{r.vb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
