"use client";

/**
 * PDF / print worker pack — uses browser print to a PDF with operator-friendly CSS.
 * Not a validated electronic batch record.
 */

import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import { slimTraces } from "@/lib/api/trace";

export function PdfWorkerPack({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const name = dossier.identity?.name || `CID ${dossier.cid}`;

  function printPack() {
    // Prefer Monday pack + job aid sections via print CSS already in globals
    document.getElementById("monday-pack")?.scrollIntoView({ block: "start" });
    window.setTimeout(() => window.print(), 200);
  }

  function copyManifest() {
    const lines = [
      `Chemistry Recipes · worker pack (public evidence)`,
      `Compound: ${name}`,
      `CID: ${dossier.cid}`,
      dossier.identity?.cas ? `CAS: ${dossier.identity.cas}` : null,
      `Generated: ${dossier.generatedAt}`,
      `Evidence score: ${dossier.evidenceScore?.score ?? "—"}/100`,
      `Mode: ${dossier.productMode || dossier.recipeReadiness?.mode || "—"}`,
      `Lit: ${dossier.literature?.length ?? 0} · Patents: ${dossier.patents?.length ?? 0}`,
      `Process facts: ${dossier.processFacts?.facts?.length ?? 0}`,
      `AI: ${dossier.synthesis.parsed ? dossier.synthesis.model || "parsed" : "shell"}`,
      `NOT a GMP batch record. Validate under site QMS.`,
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard.writeText(lines);
  }

  return (
    <div
      id="pdf-worker-pack"
      className="print:hidden scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">PDF / print pack</h2>
        <ContentProvenance
          title="PDF worker pack"
          field="PDF pack"
          pubchemCid={dossier.cid}
          traces={slimTraces(dossier.traces || [])}
          sourceRefs={dossier.sourceRefs}
          ai={dossier.synthesis.provenance}
          showAi={Boolean(dossier.synthesis.provenance)}
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Browser print → Save as PDF. Includes Monday pack and job aid when open.
        Educational handout only.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={printPack}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={copyManifest}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-teal-500/40"
        >
          Copy pack manifest
        </button>
      </div>
    </div>
  );
}
