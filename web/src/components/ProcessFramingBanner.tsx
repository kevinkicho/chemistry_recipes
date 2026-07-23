"use client";

import type { LiveDossier } from "@/lib/dossier/types";

export function ProcessFramingBanner({ dossier }: { dossier: LiveDossier }) {
  const framing =
    dossier.processFraming ||
    dossier.processFacts?.framing ||
    "evidence-lead-pack";
  const m = dossier.processFacts?.metrics;

  if (framing === "process-recipe") {
    return (
      <div
        id="process-framing"
        className="scroll-mt-24 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-50"
      >
        <strong className="font-semibold">Process-recipe framing</strong>
        <span className="text-teal-100/80">
          {" "}
          — public sourced density met (accuracy {m?.accuracyScore ?? "—"}
          /100). Still not GMP; verify every number against primary sources.
        </span>
      </div>
    );
  }

  return (
    <div
      id="process-framing"
      className="scroll-mt-24 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
    >
      <strong className="font-semibold">Evidence-lead pack</strong>
      <span className="text-amber-100/80">
        {" "}
        — not framed as a manufacturing recipe (accuracy {m?.accuracyScore ?? "—"}
        /100). Use literature/patents and local public-text enrich; do not invent
        plant CPPs.
      </span>
    </div>
  );
}
