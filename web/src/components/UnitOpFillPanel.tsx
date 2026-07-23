import type { UnitOpFill } from "@/lib/dossier/types";

export function UnitOpFillPanel({
  fills,
  modalityLabel,
}: {
  fills: UnitOpFill[];
  modalityLabel?: string;
}) {
  if (!fills?.length) return null;

  const filled = fills.filter((f) => f.status === "filled").length;
  const partial = fills.filter((f) => f.status === "partial").length;
  const empty = fills.filter((f) => f.status === "empty").length;

  return (
    <div
      id="unit-op-fill"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-lg font-semibold text-slate-100">
        Modality slot fill
        {modalityLabel ? (
          <span className="ml-2 text-sm font-normal text-slate-500">
            · {modalityLabel}
          </span>
        ) : null}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Template unit ops matched to evidence-backed steps only. Empty slots stay empty
        (no invented parameters).
      </p>
      <p className="mt-2 text-[11px] text-slate-600">
        {filled} filled · {partial} partial · {empty} empty
      </p>
      <ul className="mt-3 space-y-2">
        {fills.map((f) => (
          <li
            key={f.templateOpId}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm"
          >
            <div>
              <span className="text-slate-200">{f.title}</span>
              {f.notes ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{f.notes}</p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                f.status === "filled"
                  ? "bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30"
                  : f.status === "partial"
                    ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30"
                    : "bg-slate-800 text-slate-500 ring-1 ring-slate-700"
              }`}
            >
              {f.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
