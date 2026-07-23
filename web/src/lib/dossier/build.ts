/**
 * Build a live Tier-B dossier: free APIs + optional Ollama Cloud synthesis.
 */

import { gatherCompoundEvidence } from "@/lib/dossier/gather";
import { buildScaffoldDossier } from "@/lib/dossier/scaffold";
import {
  aiRoutesToProcessRoutes,
  synthesizeDossierFromEvidence,
} from "@/lib/dossier/synthesize";
import type { LiveDossier } from "@/lib/dossier/types";

/**
 * Non-stream build (used if needed outside SSE).
 * Always returns curated evidence scaffold; Ollama enhances when available.
 */
export async function buildLiveDossier(
  cid: number,
  opts: { synthesize?: boolean } = {}
): Promise<LiveDossier> {
  const synthesize = opts.synthesize !== false;
  const evidence = await gatherCompoundEvidence(cid);
  let dossier = buildScaffoldDossier(evidence);

  if (!synthesize) return dossier;

  const synthesis = await synthesizeDossierFromEvidence(evidence);
  if (synthesis.parsed && synthesis.routes?.length) {
    const editorialRef = [
      {
        type: "editorial" as const,
        id: `ollama-synthesis:${cid}`,
        label: "Ollama Cloud synthesis from public evidence",
        note: synthesis.model
          ? `Model ${synthesis.model} — not primary literature`
          : "AI synthesis — not primary literature",
      },
    ];
    const aiRoutes = aiRoutesToProcessRoutes(synthesis.routes, editorialRef);
    dossier = {
      ...dossier,
      processRoutes: aiRoutes.length ? aiRoutes : dossier.processRoutes,
      synthesis: {
        ...synthesis,
        apparatusCatalog:
          synthesis.apparatusCatalog?.length
            ? synthesis.apparatusCatalog
            : dossier.synthesis.apparatusCatalog,
        environmentBaseline:
          synthesis.environmentBaseline || dossier.synthesis.environmentBaseline,
        ehsHighlights:
          synthesis.ehsHighlights?.length
            ? synthesis.ehsHighlights
            : dossier.synthesis.ehsHighlights,
        provenance: synthesis.provenance,
      },
      disclaimer: synthesis.disclaimer || dossier.disclaimer,
      generatedAt: new Date().toISOString(),
    };
  } else {
    dossier = {
      ...dossier,
      synthesis: {
        ...dossier.synthesis,
        available: synthesis.available,
        model: synthesis.model,
        rawError: synthesis.rawError,
        provenance: synthesis.provenance ?? dossier.synthesis.provenance,
        gaps: [
          ...(dossier.synthesis.gaps || []),
          synthesis.rawError || "Ollama did not enhance this build",
        ],
      },
    };
  }

  return dossier;
}

/** Prefer the SSE pipeline for interactive builds. */
export async function getLiveDossier(cid: number): Promise<LiveDossier> {
  return buildLiveDossier(cid, { synthesize: true });
}
