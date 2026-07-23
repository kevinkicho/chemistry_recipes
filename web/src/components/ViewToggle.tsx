"use client";

export type AudienceView = "manufacturing" | "mechanism" | "dual";

const options: { id: AudienceView; label: string; blurb: string }[] = [
  {
    id: "manufacturing",
    label: "Manufacturing",
    blurb: "Equipment, EHS, CQAs, scale-up",
  },
  {
    id: "mechanism",
    label: "Mechanism",
    blurb: "Organic chemistry & pathways",
  },
  {
    id: "dual",
    label: "Dual",
    blurb: "Plant + R&D side by side",
  },
];

export function ViewToggle({
  value,
  onChange,
}: {
  value: AudienceView;
  onChange: (v: AudienceView) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        Audience view
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
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <div className="text-sm font-medium">{o.label}</div>
              <div className={`text-[11px] ${active ? "text-teal-100" : "text-slate-500"}`}>
                {o.blurb}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
