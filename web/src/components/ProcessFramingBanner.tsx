"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";
import { slimTraces } from "@/lib/api/trace";
import {
  isProcessFactSourceRef,
  isProcessFactTrace,
} from "@/lib/dossier/sectionHonesty";

export function ProcessFramingBanner({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const framing =
    dossier.processFraming ||
    dossier.processFacts?.framing ||
    "evidence-lead-pack";
  const m = dossier.processFacts?.metrics;
  // Framing is process-fact density (lit/patents/mfg/GHS). Leftover identity
  // / annotation HTTP is not process-framing provenance, and the chip must
  // not live-fetch identity.
  const traces = slimTraces(dossier.traces || []).filter((tr) =>
    isProcessFactTrace(tr.endpointUrl)
  );
  const sourceRefs = (dossier.sourceRefs || []).filter(isProcessFactSourceRef);

  if (framing === "process-recipe") {
    return (
      <div
        id="process-framing"
        className="scroll-mt-24 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-50"
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <strong className="font-semibold">Process-recipe framing</strong>
          <FreePublicProvenance
            dossier={dossier}
            title="Process-recipe framing"
            field="Process framing"
            traces={traces}
            sourceRefs={sourceRefs}
            liveFetch={false}
            onRegenerate={onRegenerate}
          />
        </div>
        <span className="text-teal-100/80">
          Public sourced density met (accuracy {m?.accuracyScore ?? "—"}
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
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <strong className="font-semibold">Evidence-lead pack</strong>
        <FreePublicProvenance
          dossier={dossier}
          title="Evidence-lead pack framing"
          field="Process framing"
          traces={traces}
          sourceRefs={sourceRefs}
          liveFetch={false}
          onRegenerate={onRegenerate}
        />
      </div>
      <span className="text-amber-100/80">
        Not framed as a manufacturing recipe (accuracy {m?.accuracyScore ?? "—"}
        /100). Use literature/patents and local public-text enrich; do not invent
        plant CPPs.
      </span>
    </div>
  );
}