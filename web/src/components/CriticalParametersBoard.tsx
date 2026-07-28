import { ContentProvenance } from "@/components/ContentProvenance";
import type { ProcessRoute } from "@/lib/types/process";
import type { AiProvenanceRecord } from "@/lib/dossier/types";
import type { ApiFetchTrace } from "@/lib/api/trace";

interface Row {
  routeName: string;
  stepOrder: number;
  stepTitle: string;
  kind: "critical" | "ipc" | "cqa" | "hold";
  value: string;
}

function collect(routes: ProcessRoute[]): Row[] {
  const rows: Row[] = [];
  for (const r of routes || []) {
    for (const s of r.steps || []) {
      const c = s.controls;
      if (!c) continue;
      for (const v of c.criticalParameters || []) {
        if (v?.trim())
          rows.push({
            routeName: r.name,
            stepOrder: s.order,
            stepTitle: s.title,
            kind: "critical",
            value: v.trim(),
          });
      }
      for (const v of c.ipcMethods || []) {
        if (v?.trim())
          rows.push({
            routeName: r.name,
            stepOrder: s.order,
            stepTitle: s.title,
            kind: "ipc",
            value: v.trim(),
          });
      }
      for (const v of c.cqaTargets || []) {
        if (v?.trim())
          rows.push({
            routeName: r.name,
            stepOrder: s.order,
            stepTitle: s.title,
            kind: "cqa",
            value: v.trim(),
          });
      }
      for (const v of c.holdPoints || []) {
        if (v?.trim())
          rows.push({
            routeName: r.name,
            stepOrder: s.order,
            stepTitle: s.title,
            kind: "hold",
            value: v.trim(),
          });
      }
    }
  }
  return rows.slice(0, 60);
}

const KIND_STYLE: Record<Row["kind"], string> = {
  critical: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  ipc: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  cqa: "bg-teal-500/15 text-teal-200 ring-teal-500/30",
  hold: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
};

const KIND_LABEL: Record<Row["kind"], string> = {
  critical: "CPP",
  ipc: "IPC",
  cqa: "CQA",
  hold: "Hold",
};

/**
 * Aggregated critical parameters / IPC / CQA board for tech transfer scanning.
 */
export function CriticalParametersBoard({
  routes,
  pubchemCid,
  traces,
  onRegenerate,
  ai,
}: {
  routes: ProcessRoute[];
  pubchemCid?: number;
  traces?: ApiFetchTrace[];
  onRegenerate?: () => void;
  ai?: AiProvenanceRecord | null;
}) {
  const rows = collect(routes);
  // Empty board stays out of the way — recipe page stays clean
  if (!rows.length) return null;

  return (
    <div
      id="critical-board"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Control points</h2>
        <ContentProvenance
          title="Control points"
          field="Control points"
          pubchemCid={pubchemCid}
          traces={traces}
          ai={ai}
          showAi={Boolean(ai)}
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        CPPs, IPCs, CQAs, and holds from the recipe — validate on site.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Kind</th>
              <th className="px-2 py-1.5">Parameter / method</th>
              <th className="px-2 py-1.5">Step</th>
              <th className="px-2 py-1.5">Route</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((row, i) => (
              <tr key={`${row.kind}-${i}-${row.value.slice(0, 20)}`}>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${KIND_STYLE[row.kind]}`}
                  >
                    {KIND_LABEL[row.kind]}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-slate-200">{row.value}</td>
                <td className="px-2 py-1.5 text-slate-500">
                  {row.stepOrder}. {row.stepTitle}
                </td>
                <td className="max-w-[10rem] truncate px-2 py-1.5 text-slate-500" title={row.routeName}>
                  {row.routeName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
