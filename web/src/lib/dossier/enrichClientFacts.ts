/**
 * Client-side merge of user-pasted public text + durable procedure vault
 * into process facts (survives thin re-gathers).
 */

import type {
  CompoundEvidence,
  LiveDossier,
  ProcedureExcerpt,
} from "@/lib/dossier/types";
import {
  extractProcessFacts,
  type ProcessFactBundle,
} from "@/lib/dossier/processFacts";
import { applyPlantDeliverables } from "@/lib/dossier/plantDeliverables";
import { applyTierABaseline } from "@/lib/dossier/tierABaseline";
import { getUserSupplementsForCid } from "@/lib/idb/userSupplements";
import {
  getVaultExcerptsForCid,
  putVaultExcerpts,
} from "@/lib/idb/procedureVault";
import { withRecipeReadiness } from "@/lib/dossier/recipeReadiness";

/**
 * Rebuild processFacts for a live dossier including local user supplements.
 * Uses identity/lit/patents/texts already on the dossier (no network).
 */
export function reextractFactsWithLocalSupplements(
  dossier: LiveDossier,
  vaultExtras?: ProcedureExcerpt[]
): ProcessFactBundle {
  const evidence: CompoundEvidence = {
    cid: dossier.cid,
    identity: dossier.identity,
    view: {
      cid: dossier.cid,
      blocks: [],
      hazards: {
        signalWord: dossier.hazards.signalWord,
        pictograms: dossier.hazards.ghsPictograms || [],
        hazardStatements: dossier.hazards.hazardStatements || [],
        precautionaryStatements: dossier.hazards.precautionaryStatements || [],
        rawBlocks: [],
      },
      manufacturingTexts: dossier.manufacturingTexts,
      descriptionTexts: dossier.descriptionTexts,
      propertyTexts: dossier.propertyTexts,
      traces: [],
    },
    literature: dossier.literature,
    patents: dossier.patents,
    annotations: dossier.annotations || [],
    procedureExcerpts: vaultExtras?.length
      ? [...(vaultExtras || [])]
      : undefined,
    traces: dossier.traces || [],
    sourceRefs: dossier.sourceRefs || [],
    fetchErrors: [],
  };

  const userTexts = getUserSupplementsForCid(dossier.cid).map((u) => ({
    text: u.text,
    label: u.label,
  }));

  return extractProcessFacts(evidence, userTexts);
}

export function applyLocalFactEnrichment(dossier: LiveDossier): LiveDossier {
  // Sync vault write of any literature/patent densify already on dossier
  void putVaultExcerpts(
    dossier.cid,
    (dossier.literature || [])
      .filter((h) => h.fullTextExcerpt && h.fullTextExcerpt.length >= 80)
      .map((h) => ({
        id: h.id,
        source: "europepmc-oa",
        label: h.title,
        text: h.fullTextExcerpt!,
        url: h.url,
        chars: h.fullTextExcerpt!.length,
      }))
  );
  void putVaultExcerpts(
    dossier.cid,
    (dossier.patents || [])
      .filter(
        (p) =>
          (p.procedureExcerpt && p.procedureExcerpt.length >= 80) ||
          (p.abstract && p.abstract.length >= 200)
      )
      .map((p) => ({
        id: p.id,
        source: "patent",
        label: p.title,
        text: p.procedureExcerpt || p.abstract || "",
        url: p.url,
        chars: (p.procedureExcerpt || p.abstract || "").length,
      }))
  );

  // Best-effort sync read of vault (may be empty on first paint)
  let vault: ProcedureExcerpt[] = [];
  try {
    // getVault is async — for sync path we only use user supplements;
    // async enrichment is applied by hydrateVaultIntoDossier.
  } catch {
    vault = [];
  }
  void vault;

  const processFacts = reextractFactsWithLocalSupplements(dossier);
  const withFacts: LiveDossier = {
    ...dossier,
    processFacts,
    processFraming: processFacts.framing,
    synthesis: {
      ...dossier.synthesis,
      gaps: [
        processFacts.summary,
        ...processFacts.openGaps.slice(0, 4),
        ...(dossier.synthesis.gaps || []).slice(0, 6),
      ].filter((g, i, a) => a.indexOf(g) === i),
    },
  };
  let next = applyPlantDeliverables(withFacts);
  next = applyTierABaseline(next);
  next = applyPlantDeliverables(next);
  next = withRecipeReadiness(next);
  return next;
}

/** Async: merge durable vault procedure windows into process facts. */
export async function hydrateVaultIntoDossier(
  dossier: LiveDossier
): Promise<LiveDossier> {
  const rows = await getVaultExcerptsForCid(dossier.cid);
  // Persist densify from this dossier into vault for next rebuild
  await putVaultExcerpts(
    dossier.cid,
    (dossier.literature || [])
      .filter((h) => h.fullTextExcerpt && h.fullTextExcerpt.length >= 80)
      .map((h) => ({
        id: h.id,
        source: "europepmc-oa",
        label: h.title,
        text: h.fullTextExcerpt!,
        url: h.url,
      }))
  );
  await putVaultExcerpts(
    dossier.cid,
    (dossier.patents || [])
      .filter((p) => (p.procedureExcerpt || p.abstract || "").length >= 80)
      .map((p) => ({
        id: p.id,
        source: "patent",
        label: p.title,
        text: p.procedureExcerpt || p.abstract || "",
        url: p.url,
      }))
  );
  const vault: ProcedureExcerpt[] = rows.map((r) => ({
    id: r.key,
    source: (r.source as ProcedureExcerpt["source"]) || "other",
    label: r.label,
    text: r.text,
    url: r.url,
    chars: r.chars,
  }));
  if (!vault.length) return applyLocalFactEnrichment(dossier);

  const processFacts = reextractFactsWithLocalSupplements(dossier, vault);
  let next: LiveDossier = {
    ...dossier,
    processFacts,
    processFraming: processFacts.framing,
  };
  next = applyPlantDeliverables(next);
  next = applyTierABaseline(next);
  next = applyPlantDeliverables(next);
  next = withRecipeReadiness(next);
  return next;
}
