"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RelatedEntity } from "@/lib/types/process";
import { routes } from "@/lib/routes";
import { resolveRelatedEntityCids } from "@/lib/frontier/relatedEntityResolve";

const ROLE_ORDER = [
  "starting-material",
  "intermediate",
  "reagent",
  "catalyst",
  "solvent",
  "impurity",
  "api",
  "drug-product",
  "excipient",
  "media-component",
  "raw-material",
  "reference-standard",
  "other",
] as const;

/**
 * Role-grouped multi-CID graph of related entities (API ↔ intermediates ↔ DP).
 * Edges with PubChem CIDs open live dossiers. Can resolve missing CIDs via free search.
 */
export function EntityGraph({
  centerName,
  entities,
  centerCid,
  onEntitiesResolved,
}: {
  centerName: string;
  entities: RelatedEntity[];
  centerCid?: number;
  onEntitiesResolved?: (entities: RelatedEntity[]) => void;
}) {
  const [display, setDisplay] = useState(entities);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDisplay(entities);
    setMsg(null);
  }, [entities]);

  if (!display?.length) return null;

  const linked = display.filter((e) => e.pubchemCid || e.cas || e.href);
  const multiCid = display.filter((e) => e.pubchemCid).length;
  const missing = display.filter((e) => !e.pubchemCid && e.name).length;

  const byRole = new Map<string, RelatedEntity[]>();
  for (const e of display) {
    const list = byRole.get(e.role) || [];
    list.push(e);
    byRole.set(e.role, list);
  }

  const orderedRoles = ROLE_ORDER.filter((r) => byRole.has(r));

  async function resolveCids() {
    setBusy(true);
    setMsg("Resolving missing CIDs via free-public search…");
    try {
      const { entities: next, report } = await resolveRelatedEntityCids(
        display,
        { maxResolve: 8 }
      );
      setDisplay(next);
      onEntitiesResolved?.(next);
      setMsg(
        `Resolved ${report.resolved}/${report.attempted} related CID(s)` +
          (report.failed ? ` · ${report.failed} unresolved` : "")
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Multi-CID process graph
        </div>
        <div className="text-[10px] text-slate-600">
          {multiCid} linked CID{multiCid === 1 ? "" : "s"} · {linked.length}{" "}
          openable
        </div>
      </div>
      <p className="mt-1 text-[10px] text-slate-600">
        Impurities / intermediates / reagents from public evidence — open live
        dossiers; no invented plant numbers.
      </p>
      {missing > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolveCids()}
          className="mt-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-40"
        >
          {busy
            ? "Resolving CIDs…"
            : `Resolve missing PubChem CIDs (${missing})`}
        </button>
      ) : null}
      {msg ? (
        <p className="mt-1 text-[10px] text-teal-300/90" role="status">
          {msg}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-stretch justify-center gap-2">
        <div className="flex min-w-[7rem] max-w-[10rem] flex-col items-center justify-center rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-center">
          <span className="text-[9px] uppercase text-teal-500/80">Center</span>
          {centerCid ? (
            <Link
              href={routes.pubchem(centerCid)}
              className="text-xs font-semibold text-teal-100 hover:underline"
            >
              {centerName}
            </Link>
          ) : (
            <span className="text-xs font-semibold text-teal-100">
              {centerName}
            </span>
          )}
          {centerCid ? (
            <span className="mt-0.5 font-mono text-[9px] text-teal-500/70">
              CID {centerCid}
            </span>
          ) : null}
        </div>
        {orderedRoles.map((role) => (
          <div
            key={role}
            className="min-w-[8rem] max-w-[12rem] rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2"
          >
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              {role}
            </div>
            <ul className="space-y-1">
              {(byRole.get(role) || []).slice(0, 6).map((e, i) => {
                const href =
                  e.href ||
                  (e.pubchemCid
                    ? routes.pubchem(e.pubchemCid)
                    : e.cas
                      ? routes.search(e.cas)
                      : null);
                return (
                  <li
                    key={`${e.name}-${i}`}
                    className="text-[11px] leading-snug"
                  >
                    {href ? (
                      <Link
                        href={href}
                        className="text-teal-300/90 hover:underline"
                      >
                        {e.name}
                      </Link>
                    ) : (
                      <span className="text-slate-300">{e.name}</span>
                    )}
                    {e.pubchemCid ? (
                      <span className="ml-1 font-mono text-[9px] text-slate-600">
                        CID {e.pubchemCid}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
