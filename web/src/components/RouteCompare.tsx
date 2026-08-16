"use client";

import { useMemo, useState } from "react";
import type { ProcessRoute } from "@/lib/types/process";
import { FreePublicBadge } from "@/components/FreePublicProvenance";

function routeLabel(r: ProcessRoute): string {
  return `${r.name} · ${r.type} · ${r.scaleClass}`;
}

function collectCritical(r: ProcessRoute): string[] {
  const out: string[] = [];
  for (const s of r.steps || []) {
    for (const c of s.controls?.criticalParameters || []) {
      if (c?.trim()) out.push(`${s.order}. ${c.trim()}`);
    }
  }
  return out.slice(0, 12);
}

function collectEquipment(r: ProcessRoute): string[] {
  const set = new Set<string>();
  for (const s of r.steps || []) {
    for (const a of s.apparatus || []) {
      if (a.equipmentClass) set.add(String(a.equipmentClass));
    }
  }
  return [...set].slice(0, 16);
}

function collectMaterials(r: ProcessRoute): string[] {
  return (r.materials || [])
    .map((m) => `${m.role}: ${m.name}${m.cas ? ` (${m.cas})` : ""}`)
    .slice(0, 16);
}

function collectConditions(r: ProcessRoute): string[] {
  const out: string[] = [];
  for (const s of r.steps || []) {
    if (!s.conditions) continue;
    const bits = [
      s.conditions.temperatureC && `T ${s.conditions.temperatureC}`,
      s.conditions.time && `t ${s.conditions.time}`,
      s.conditions.pressure && `P ${s.conditions.pressure}`,
      s.conditions.atmosphere && s.conditions.atmosphere,
    ].filter(Boolean);
    if (bits.length) out.push(`${s.order}. ${s.title}: ${bits.join("; ")}`);
  }
  return out.slice(0, 12);
}

function RoutePlantCard({
  route,
  label,
}: {
  route: ProcessRoute;
  label: string;
}) {
  const mats = collectMaterials(route);
  const equip = collectEquipment(route);
  const crit = collectCritical(route);
  const conds = collectConditions(route);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <h3 className="mt-1 text-sm font-semibold text-slate-100">{route.name}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {route.type} · {route.scaleClass}
        {route.overallYieldTypical
          ? ` · yield ${route.overallYieldTypical}`
          : ""}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{route.summary}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">
            BOM / materials
          </div>
          {mats.length ? (
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
              {mats.map((m) => (
                <li key={m}>· {m}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-slate-600">No BOM extracted</p>
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">
            Equipment classes
          </div>
          {equip.length ? (
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
              {equip.map((e) => (
                <li key={e}>
                  <code className="text-teal-300/90">{e}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-slate-600">None listed</p>
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">
            Public conditions
          </div>
          {conds.length ? (
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
              {conds.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-slate-600">No numeric conditions</p>
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">
            Critical cues
          </div>
          {crit.length ? (
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
              {crit.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-slate-600">
              No CPPs listed (site-fill)
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase text-slate-500">
          Steps ({route.steps?.length || 0})
        </div>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] text-slate-400">
          {(route.steps || []).slice(0, 8).map((s) => (
            <li key={s.id}>
              <span className="text-slate-300">{s.title}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Side-by-side comparison of process routes (or single-route plant panel).
 */
export function RouteCompare({ routes }: { routes: ProcessRoute[] }) {
  const usable = routes.filter((r) => r && r.id);
  const [leftId, setLeftId] = useState(usable[0]?.id || "");
  const [rightId, setRightId] = useState(usable[1]?.id || usable[0]?.id || "");

  const left = useMemo(
    () => usable.find((r) => r.id === leftId) || usable[0],
    [usable, leftId]
  );
  const right = useMemo(
    () => usable.find((r) => r.id === rightId) || usable[1] || usable[0],
    [usable, rightId]
  );

  if (usable.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
        No process routes yet. Free-public densify leads,
        Ollama synthesis will populate this panel.
      </div>
    );
  }

  // Single route — still show full plant scouting card (like mock one-route dossiers)
  if (usable.length === 1 && left) {
    return (
      <div id="route-compare" className="scroll-mt-24 space-y-3">
        <p className="text-xs text-slate-500">
          One public process route on this dossier — plant scouting panel (BOM,
          equipment, conditions). A second route (e.g. densified lit/patent or AI
          alternative) enables side-by-side compare.
        </p>
        <RoutePlantCard route={left} label="Preferred route" />
      </div>
    );
  }

  return (
    <div id="route-compare" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FreePublicBadge note="route compare · free-public / AI structure · not GMP" />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Route A
          </span>
          <select
            value={left?.id}
            onChange={(e) => setLeftId(e.target.value)}
            className="mt-1 block w-full min-w-[12rem] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {usable.map((r) => (
              <option key={r.id} value={r.id}>
                {routeLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Route B
          </span>
          <select
            value={right?.id}
            onChange={(e) => setRightId(e.target.value)}
            className="mt-1 block w-full min-w-[12rem] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {usable.map((r) => (
              <option key={r.id} value={r.id}>
                {routeLabel(r)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {left ? <RoutePlantCard route={left} label="Route A" /> : null}
        {right ? <RoutePlantCard route={right} label="Route B" /> : null}
      </div>
    </div>
  );
}
