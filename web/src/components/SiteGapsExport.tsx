"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { getSiteFill } from "@/lib/idb/siteFill";
import { assessRecipeReadiness } from "@/lib/dossier/recipeReadiness";

/**
 * One-pager: public open gaps + local site-fill blanks for MSAT meetings.
 */
export function SiteGapsExport({ dossier }: { dossier: LiveDossier }) {
  function download() {
    const fill = getSiteFill(dossier.cid);
    const readiness =
      dossier.recipeReadiness ||
      assessRecipeReadiness({
        processFacts: dossier.processFacts,
        literature: dossier.literature,
        patents: dossier.patents,
        view: {
          cid: dossier.cid,
          manufacturingTexts: dossier.manufacturingTexts,
          descriptionTexts: dossier.descriptionTexts,
          propertyTexts: dossier.propertyTexts,
          blocks: [],
          hazards: {
            pictograms: [],
            hazardStatements: dossier.hazards.hazardStatements || [],
            precautionaryStatements: [],
            rawBlocks: [],
          },
          traces: [],
        },
        annotations: dossier.annotations,
        identity: dossier.identity,
      });

    const name = dossier.identity?.name || `CID ${dossier.cid}`;
    const lines = [
      "Chemistry Recipes — Site open-gaps one-pager",
      `Molecule: ${name} (CID ${dossier.cid})`,
      `Generated: ${new Date().toISOString()}`,
      `Mode: ${dossier.productMode || readiness.mode} · readiness ${readiness.score}/100`,
      "",
      "NOT GMP. NOT a batch record. Public evidence + local site-fill only.",
      "",
      "=== Public evidence gaps (blockers / major) ===",
      ...readiness.gaps
        .filter((g) => g.severity === "blocker" || g.severity === "major")
        .map((g) => `- [${g.severity}] ${g.label}: ${g.detail}`),
      "",
      "=== Process-fact open gaps ===",
      ...(dossier.processFacts?.openGaps || []).map((g) => `- ${g}`),
      "",
      "=== Site fill (this browser only) ===",
      `Temperature: ${fill?.siteTemp || "(empty — site QMS)"}`,
      `Time: ${fill?.siteTime || "(empty — site QMS)"}`,
      `Pressure: ${fill?.sitePressure || "(empty — site QMS)"}`,
      `Equipment tag: ${fill?.equipmentTag || "(empty)"}`,
      `IPC method: ${fill?.ipcMethod || "(empty)"}`,
      `Batch size: ${fill?.batchSize || "(empty)"}`,
      `Notes: ${fill?.notes || "(empty)"}`,
      "",
      "Actions for site team:",
      "1. Paste public patent examples if procedure density is thin.",
      "2. Fill site blanks under QMS ownership.",
      "3. Do not treat public numbers as validated CPPs.",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-gaps-cid-${dossier.cid}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="print:hidden rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-xs text-slate-500">
        Export a plain-text one-pager of public gaps + your local site-fill blanks for tech-transfer
        meetings.
      </p>
      <button
        type="button"
        onClick={download}
        className="mt-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-teal-500/40 hover:text-teal-100"
      >
        Download site open-gaps (.txt)
      </button>
    </div>
  );
}
