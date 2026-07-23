import type { ParameterSet, ProcessParameterSpec } from "@/lib/modality/biologicParameters";
import { PARAMETER_DISCLAIMER } from "@/lib/modality/biologicParameters";

const CAT: Record<string, string> = {
  cpp: "CPP",
  cqa: "CQA",
  ipc: "IPC",
  hold: "Hold",
  utility: "Util",
  ehs: "EHS",
};

const CAT_STYLE: Record<string, string> = {
  cpp: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  cqa: "bg-teal-500/15 text-teal-200 ring-teal-500/30",
  ipc: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  hold: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
  utility: "bg-slate-700/50 text-slate-300 ring-slate-600",
  ehs: "bg-orange-500/15 text-orange-100 ring-orange-500/30",
};

const FILL_STYLE: Record<string, string> = {
  "literature-typical": "text-amber-200/90",
  "site-fill-required": "text-slate-500",
  "evidence-only": "text-violet-300/90",
  "template-empty": "text-slate-600 italic",
};

function Row({ p }: { p: ProcessParameterSpec }) {
  return (
    <tr className="border-t border-slate-800/80">
      <td className="px-2 py-1.5 align-top">
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${CAT_STYLE[p.category] || CAT_STYLE.utility}`}
        >
          {CAT[p.category] || p.category}
        </span>
      </td>
      <td className="px-2 py-1.5 align-top">
        <div className="text-slate-200">{p.name}</div>
        {p.rationale ? (
          <div className="mt-0.5 text-[10px] text-slate-600">{p.rationale}</div>
        ) : null}
      </td>
      <td className="px-2 py-1.5 align-top font-mono text-[11px] text-slate-500">
        {p.unit || "—"}
      </td>
      <td className={`px-2 py-1.5 align-top text-[11px] ${FILL_STYLE[p.fillStatus] || ""}`}>
        {p.literatureTypical || (
          <span className="text-slate-600">Site fill required — no invented value</span>
        )}
        <div className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">
          {p.fillStatus.replace(/-/g, " ")}
        </div>
      </td>
    </tr>
  );
}

/**
 * Educational biologic / process parameter table.
 * Literature-typical = teaching envelope only — never GMP.
 */
export function BiologicParametersPanel({
  parameterSet,
  title,
}: {
  parameterSet: ParameterSet;
  title?: string;
}) {
  return (
    <div
      id="process-parameters"
      className="scroll-mt-24 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"
    >
      <h2 className="text-lg font-semibold text-slate-100">
        {title || parameterSet.label}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{parameterSet.summary}</p>
      <div
        role="note"
        className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-100/90"
      >
        <strong className="text-amber-200">Not invented plant limits. </strong>
        {PARAMETER_DISCLAIMER}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-xs text-slate-300">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Kind</th>
              <th className="px-2 py-1.5">Parameter</th>
              <th className="px-2 py-1.5">Unit</th>
              <th className="px-2 py-1.5">Educational envelope / status</th>
            </tr>
          </thead>
          <tbody>
            {parameterSet.parameters.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
