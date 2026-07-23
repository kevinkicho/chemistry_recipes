import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DossierClientLoader } from "@/components/dossier/DossierClientLoader";

type Props = { params: Promise<{ cid: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cid } = await params;
  return {
    title: `Compound CID ${cid}`,
    description: `Live free-public dossier for PubChem CID ${cid} (APIs + Ollama)`,
  };
}

/**
 * Compound page shell — client loader freezes UI and streams multi-API progress,
 * then renders the live dossier (no static molecule data).
 * IndexedDB cache is client-side; `?refresh=1` forces a live rebuild.
 */
export default async function PubchemCompoundPage({ params }: Props) {
  const { cid: cidStr } = await params;
  const cid = Number(cidStr);
  if (!Number.isFinite(cid) || cid <= 0) notFound();

  return (
    <Suspense
      fallback={
        <div className="w-full p-6 text-sm text-slate-500">Loading compound CID {cid}…</div>
      }
    >
      <DossierClientLoader cid={cid} />
    </Suspense>
  );
}
