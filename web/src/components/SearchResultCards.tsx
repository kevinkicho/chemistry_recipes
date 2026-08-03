"use client";

import Link from "next/link";
import { ApiProvenance } from "@/components/ApiProvenance";
import { PubchemStructureImage } from "@/components/PubchemStructureImage";
import { routes } from "@/lib/routes";
import { findHubByCid } from "@/lib/data/hubIndex";
import type { MultiSourceHit } from "@/lib/search/multiSourceSearch";

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
  return (
    <MultiSourceResultCard
      hit={{
        cid,
        name,
        formula,
        molecularWeight,
        cas,
        inchiKey,
        sources: [
          {
            source: "pubchem",
            label: "PubChem · NIH",
            externalId: String(cid),
            url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
          },
        ],
        score: 40,
        openable: true,
      }}
      href={href}
    />
  );
}

/**
 * Multi-source free-public search card (openable when CID resolved).
 */
export function MultiSourceResultCard({
  hit,
  href,
}: {
  hit: MultiSourceHit;
  href?: string;
}) {
  const cid = hit.cid;
  const target =
    href ?? (cid && cid > 0 ? routes.pubchem(cid) : undefined);
  const hub = cid ? findHubByCid(cid) : undefined;
  const name = hit.name;

  const body = (
    <>
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white p-1">
        {cid ? (
          <PubchemStructureImage
            cid={cid}
            size="small"
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-[10px] text-slate-400">no CID</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-100">{name}</div>
        <div className="mt-0.5 font-mono text-xs text-slate-500">
          {cid ? `CID ${cid}` : "CID unresolved"}
          {hit.formula ? ` · ${hit.formula}` : ""}
          {hit.molecularWeight != null
            ? ` · ${hit.molecularWeight.toFixed(2)} g/mol`
            : ""}
          {hit.cas ? ` · ${hit.cas}` : hub?.cas ? ` · ${hub.cas}` : ""}
          {hit.unii ? ` · UNII ${hit.unii}` : ""}
        </div>
        {hit.inchiKey ? (
          <div className="mt-0.5 truncate font-mono text-[10px] text-slate-600">
            {hit.inchiKey}
          </div>
        ) : null}
        {hit.formKind && hit.formKind !== "parent" ? (
          <div className="mt-0.5">
            <span className="inline-flex rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-inset ring-violet-500/30">
              {hit.formKind === "salt"
                ? "Salt / form"
                : hit.formKind === "hydrate"
                  ? "Hydrate"
                  : hit.formKind === "ester"
                    ? "Ester"
                    : "Related form"}
            </span>
          </div>
        ) : null}
        {hit.note ? (
          <div className="mt-0.5 truncate text-[10px] text-slate-500">
            {hit.note}
          </div>
        ) : null}
        {hit.processLiteratureCount != null && hit.processLiteratureCount > 0 ? (
          <div className="mt-0.5 text-[10px] text-emerald-300/80">
            {hit.processLiteratureCount} process-relevant Europe PMC paper
            {hit.processLiteratureCount === 1 ? "" : "s"}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {hit.sources.map((s) => (
            <span
              key={`${s.source}-${s.externalId || s.label}`}
              className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-200 ring-1 ring-inset ring-sky-500/30"
              title={s.externalId || s.url}
            >
              {s.label}
            </span>
          ))}
          {hub ? (
            <>
              <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-200 ring-1 ring-inset ring-teal-500/25">
                {hub.modality}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-inset ring-slate-700">
                {hub.entityRole}
              </span>
              {hub.kind === "example" ? (
                <span
                  className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-100 ring-1 ring-inset ring-amber-500/30"
                  title="A demo twin exists under Info — this card still opens the live PubChem dossier"
                >
                  Live · demo twin in Info
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-inset ring-violet-500/25">
                  Live hub
                </span>
              )}
            </>
          ) : null}
          {!target ? (
            <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-inset ring-slate-700">
              Identity only
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <div className="relative flex gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 hover:border-teal-500/30">
      {cid ? (
        <div className="absolute right-2 top-2 z-10">
          <ApiProvenance pubchemCid={cid} title={name} label="API" />
        </div>
      ) : null}
      {target ? (
        <Link href={target} className="flex min-w-0 flex-1 gap-3 pr-10">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 gap-3 pr-4">{body}</div>
      )}
    </div>
  );
}
