import Link from "next/link";
import type { RelatedEntity } from "@/lib/types/process";
import { routes } from "@/lib/routes";

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
 * Simple role-grouped graph of related entities (API ↔ intermediates ↔ DP).
 */
export function EntityGraph({
  centerName,
  entities,
}: {
  centerName: string;
  entities: RelatedEntity[];
}) {
  if (!entities?.length) return null;

  const byRole = new Map<string, RelatedEntity[]>();
  for (const e of entities) {
    const list = byRole.get(e.role) || [];
    list.push(e);
    byRole.set(e.role, list);
  }

  const orderedRoles = ROLE_ORDER.filter((r) => byRole.has(r));

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Entity graph
      </div>
      <div className="mt-3 flex flex-wrap items-stretch justify-center gap-2">
        <div className="flex min-w-[7rem] max-w-[10rem] flex-col items-center justify-center rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-center">
          <span className="text-[9px] uppercase text-teal-500/80">Center</span>
          <span className="text-xs font-semibold text-teal-100">{centerName}</span>
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
                  <li key={`${e.name}-${i}`} className="text-[11px] leading-snug">
                    {href ? (
                      <Link href={href} className="text-teal-300/90 hover:underline">
                        {e.name}
                      </Link>
                    ) : (
                      <span className="text-slate-300">{e.name}</span>
                    )}
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
