"use client";

import { useMemo, useState } from "react";
import type { ProcessRoute } from "@/lib/types/process";

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

/**
 * Side-by-side comparison of two process routes (tech-transfer / scouting).
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

  if (usable.length < 2) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
        Route compare needs at least two routes on this dossier. After AI synthesis
        produces dual routes (or when public leads + AI routes coexist), pick any two
        here for BOM, scale, and critical-parameter comparison.
      </div>
    );
  }

  return (
    <div id="route-compare" className="scroll-mt-24 space-y-4">
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
              <option key={`b-${r.id}`} value={r.id}>
                {routeLabel(r)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {left && right ? (
          <>
            <CompareColumn route={left} accent="teal" />
            <CompareColumn route={right} accent="violet" />
          </>
        ) : null}
      </div>

      {left && right ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[32rem] text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Dimension</th>
                <th className="px-3 py-2">Route A</th>
                <th className="px-3 py-2">Route B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <Row label="Type" a={left.type} b={right.type} />
              <Row label="Scale class" a={left.scaleClass} b={right.scaleClass} />
              <Row
                label="Steps"
                a={String(left.steps?.length ?? 0)}
                b={String(right.steps?.length ?? 0)}
              />
              <Row
                label="Materials (BOM lines)"
                a={String(left.materials?.length ?? 0)}
                b={String(right.materials?.length ?? 0)}
              />
              <Row
                label="Yield note"
                a={left.overallYieldTypical || "—"}
                b={right.overallYieldTypical || "—"}
              />
              <Row
                label="Equipment classes"
                a={collectEquipment(left).join(", ") || "—"}
                b={collectEquipment(right).join(", ") || "—"}
              />
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  const differ = a !== b;
  return (
    <tr className={differ ? "bg-amber-500/5" : undefined}>
      <td className="px-3 py-2 font-medium text-slate-400">{label}</td>
      <td className="px-3 py-2">{a}</td>
      <td className="px-3 py-2">{b}</td>
    </tr>
  );
}

function CompareColumn({
  route,
  accent,
}: {
  route: ProcessRoute;
  accent: "teal" | "violet";
}) {
  const ring =
    accent === "teal" ? "border-teal-500/30" : "border-violet-500/30";
  const title =
    accent === "teal" ? "text-teal-300" : "text-violet-300";
  return (
    <article className={`rounded-xl border ${ring} bg-slate-900/50 p-4`}>
      <h3 className={`text-sm font-semibold ${title}`}>{route.name}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {route.type} · {route.scaleClass} · pref {route.preference}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{route.summary}</p>
      {route.advantages?.length ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Advantages
          </div>
          <ul className="mt-1 list-inside list-disc text-xs text-slate-400">
            {route.advantages.slice(0, 5).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {route.disadvantages?.length ? (
        <div className="mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Disadvantages
          </div>
          <ul className="mt-1 list-inside list-disc text-xs text-slate-400">
            {route.disadvantages.slice(0, 5).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          BOM (sample)
        </div>
        <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-400">
          {collectMaterials(route).length ? (
            collectMaterials(route).map((m) => <li key={m}>{m}</li>)
          ) : (
            <li className="text-slate-600">No materials listed</li>
          )}
        </ul>
      </div>
      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Critical parameters
        </div>
        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
          {collectCritical(route).length ? (
            collectCritical(route).map((c) => <li key={c}>{c}</li>)
          ) : (
            <li className="text-slate-600">None extracted</li>
          )}
        </ul>
      </div>
    </article>
  );
}
