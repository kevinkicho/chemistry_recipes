import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DossierClientLoader } from "@/components/dossier/DossierClientLoader";
import { findHubByCid } from "@/lib/data/hubIndex";
import { getPubChemCompound } from "@/lib/api/pubchem";

type Props = { params: Promise<{ cid: string }> };

export const dynamic = "force-dynamic";

async function resolveIdentity(cid: number): Promise<{
  name: string;
  formula?: string;
  cas?: string;
  molecularWeight?: number;
}> {
  const hub = findHubByCid(cid);
  try {
    const raced = await Promise.race([
      getPubChemCompound(cid),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 2800);
      }),
    ]);
    if (raced && "hit" in raced && raced.hit) {
      return {
        name: raced.hit.name || hub?.name || `CID ${cid}`,
        formula: raced.hit.formula,
        cas: raced.hit.cas || hub?.cas,
        molecularWeight: raced.hit.molecularWeight,
      };
    }
  } catch {
    /* soft — shell still loads client-side */
  }
  return {
    name: hub?.name || `CID ${cid}`,
    cas: hub?.cas,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cid: cidStr } = await params;
  const cid = Number(cidStr);
  if (!Number.isFinite(cid) || cid <= 0) {
    return { title: "Compound" };
  }
  const id = await resolveIdentity(cid);
  return {
    title: `${id.name} · CID ${cid}`,
    description: `AI dual-view process dossier for ${id.name} (PubChem CID ${cid}) — free-public multi-API densify + Ollama structure.`,
  };
}

/**
 * Compound page shell — SSR identity for share/debug; client loader streams
 * densify + AI dual-view progress into the live dossier.
 */
export default async function PubchemCompoundPage({ params }: Props) {
  const { cid: cidStr } = await params;
  const cid = Number(cidStr);
  if (!Number.isFinite(cid) || cid <= 0) notFound();

  const id = await resolveIdentity(cid);

  return (
    <div className="w-full">
      <header className="border-b border-slate-800 bg-slate-950/80 px-4 py-3 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-400/90">
          Live · free-public densify + AI dual-view
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          {id.name}
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          PubChem CID {cid}
          {id.formula ? ` · ${id.formula}` : ""}
          {id.molecularWeight != null
            ? ` · ${id.molecularWeight.toFixed(2)} g/mol`
            : ""}
          {id.cas ? ` · CAS ${id.cas}` : ""}
        </p>
      </header>
      <Suspense
        fallback={
          <div className="w-full p-6 text-sm text-slate-500">
            Loading AI-ready densify pipeline for {id.name} (CID {cid})…
          </div>
        }
      >
        <DossierClientLoader cid={cid} />
      </Suspense>
    </div>
  );
}
