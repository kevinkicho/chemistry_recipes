"use client";

export type AudienceView = "manufacturing" | "mechanism" | "dual";

const options: { id: AudienceView; label: string; short: string }[] = [
  { id: "manufacturing", label: "Plant", short: "Equipment · EHS · CQAs" },
  { id: "mechanism", label: "Chemistry", short: "Mechanism · pathways" },
  { id: "dual", label: "Dual", short: "Side by side" },
];

export function ViewToggle({
  value,
  onChange,
  compact = false,
}: {
  value: AudienceView;
  onChange: (v: AudienceView) => void;
  /** Single-line segment control for tight toolbars */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className="inline-flex shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-0.5"
        role="group"
        aria-label="Audience view"
      >
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-teal-600 text-white shadow"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        View
      </div>
      <div className="inline-flex flex-wrap rounded-lg border border-slate-700 bg-slate-900 p-1">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`rounded-md px-3 py-2 text-left transition-colors ${
                active
                  ? "bg-teal-600 text-white shadow"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <div className="text-sm font-medium">{o.label}</div>
              <div
                className={`text-[11px] ${active ? "text-teal-100" : "text-slate-500"}`}
              >
                {o.short}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
