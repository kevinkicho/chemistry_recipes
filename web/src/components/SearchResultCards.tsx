"use client";

import Link from "next/link";
import { ApiProvenance } from "@/components/ApiProvenance";
import { pubchemStructureUrl } from "@/lib/api/pubchem";
import { routes } from "@/lib/routes";
import { findHubByCid } from "@/lib/data/hubIndex";

/**
 * PubChem search hit. Provenance is per-CID: live NIH fetch on API open.
 * If CID is in the hub index, show modality / role chips.
 */
export function PubChemResultCard({
  href,
  cid,
  name,
  formula,
  molecularWeight,
  cas,
  inchiKey,
}: {
  href?: string;
  cid: number;
  name: string;
  formula?: string;
  molecularWeight?: number;
  cas?: string;
  inchiKey?: string;
}) {
  const target = href ?? routes.pubchem(cid);
  const hub = findHubByCid(cid);

  return (
    <div className="relative flex gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 hover:border-teal-500/30">
      <div className="absolute right-2 top-2 z-10">
        <ApiProvenance pubchemCid={cid} title={name} label="API" />
      </div>
      <Link href={target} className="flex min-w-0 flex-1 gap-3 pr-10">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pubchemStructureUrl(cid, "small")}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-100">{name}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">
            CID {cid}
            {formula ? ` · ${formula}` : ""}
            {molecularWeight != null ? ` · ${molecularWeight.toFixed(2)} g/mol` : ""}
            {cas ? ` · ${cas}` : hub?.cas ? ` · ${hub.cas}` : ""}
          </div>
          {inchiKey ? (
            <div className="mt-0.5 truncate font-mono text-[10px] text-slate-600">
              {inchiKey}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-300 ring-1 ring-inset ring-sky-500/30">
              PubChem · NIH
            </span>
            {hub ? (
              <>
                <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-200 ring-1 ring-inset ring-teal-500/25">
                  {hub.modality}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-inset ring-slate-700">
                  {hub.entityRole}
                </span>
                {hub.kind === "example" ? (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-100 ring-1 ring-inset ring-amber-500/30">
                    Tier-A example
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-inset ring-violet-500/25">
                    Hub live
                  </span>
                )}
              </>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
