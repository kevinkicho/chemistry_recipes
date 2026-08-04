"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  COLD_CID_FLOORS,
  GOLDEN_COLD_CIDS,
  evaluateColdCidFloors,
  type ColdCidKpiSnapshot,
} from "@/lib/dossier/coldCidKpi";
import { getCachedDossier } from "@/lib/idb/dossierCache";
import { routes } from "@/lib/routes";

/**
 * Diagnostics: local densify floors for golden cold CIDs (IndexedDB only).
 */
export function ColdCidKpiPanel() {
  const [rows, setRows] = useState<
    Array<ColdCidKpiSnapshot & { cached: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);

  const scan = useCallback(async () => {
    setLoading(true);
    const out: Array<ColdCidKpiSnapshot & { cached: boolean }> = [];
    for (const g of GOLDEN_COLD_CIDS) {
      const cached = await getCachedDossier(g.cid);
      const d = cached?.dossier;
      if (!d) {
        out.push({
          ...evaluateColdCidFloors({ cid: g.cid, name: g.name }),
          cached: false,
          gaps: ["not in local densify cache — open CID to densify"],
          meetsFloor: false,
        });
        continue;
      }
      const procChars =
        (d.procedureExcerpts || []).reduce(
          (n, p) => n + (p.chars || p.text.length),
          0
        ) ||
        (d.literature || []).reduce(
          (n, h) => n + (h.fullTextExcerpt?.length || 0),
          0
        );
      const facts =
        d.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ?? 0;
      const snap = evaluateColdCidFloors({
        cid: g.cid,
        name: d.identity?.name || g.name,
        procedureChars: procChars,
        processFacts: facts,
        idealParity: d.idealParity?.score ?? 0,
        evidenceScore: d.evidenceScore?.score ?? 0,
        framing: d.processFraming,
        productMode: d.productMode,
      });
      out.push({ ...snap, cached: true });
    }
    setRows(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    void scan();
  }, [scan]);

  const met = rows.filter((r) => r.meetsFloor).length;
  const cached = rows.filter((r) => r.cached).length;

  return (
    <section
      id="cold-cid-kpi"
      className="scroll-mt-24 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
    >
      <h2 className="text-sm font-semibold text-amber-100">
        Cold-CID densify floors
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Free-public densify quality for golden CIDs (local cache). Floors: ≥
        {COLD_CID_FLOORS.procedureChars} procedure chars · ≥
        {COLD_CID_FLOORS.processFacts} facts · ideal ≥{COLD_CID_FLOORS.idealParity} ·
        evidence ≥{COLD_CID_FLOORS.evidenceScore}. Not GMP.
      </p>
      <p className="mt-2 font-mono text-[11px] text-slate-300">
        {loading
          ? "Scanning IndexedDB…"
          : `${met}/${rows.length} meet floor · ${cached} cached · ${rows.length - cached} not densified yet`}
      </p>
      <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-[11px]">
        {rows.map((r) => (
          <li
            key={r.cid}
            className={`flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
              r.meetsFloor
                ? "border-emerald-500/30 bg-emerald-500/5"
                : r.cached
                  ? "border-amber-500/25 bg-slate-950/40"
                  : "border-slate-800 bg-slate-950/30"
            }`}
          >
            <span>
              <Link
                href={routes.pubchem(r.cid)}
                className="font-medium text-teal-300 hover:underline"
              >
                {r.name}
              </Link>
              <span className="ml-1.5 font-mono text-slate-500">CID {r.cid}</span>
              {r.cached ? (
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  proc {r.procedureChars} · facts {r.processFacts} · ideal{" "}
                  {r.idealParity} · evidence {r.evidenceScore}
                  {r.framing ? ` · ${r.framing}` : ""}
                </span>
              ) : (
                <span className="mt-0.5 block text-[10px] text-slate-600">
                  {r.gaps[0]}
                </span>
              )}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                r.meetsFloor
                  ? "bg-emerald-500/20 text-emerald-100"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {r.meetsFloor ? "floor ok" : r.cached ? "below" : "open"}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void scan()}
        className="mt-3 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-500/40"
      >
        Rescan local cache
      </button>
    </section>
  );
}
