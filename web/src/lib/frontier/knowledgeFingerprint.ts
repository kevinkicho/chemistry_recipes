/**
 * Fingerprint live dossier inputs that affect process-knowledge rebuild.
 * Skip expensive rebuild when fingerprint matches.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessKnowledgePackage } from "@/lib/frontier/types";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import { assessIdealPageParity } from "@/lib/dossier/idealPage";

/** Stable string for densify/knowledge-relevant dossier fields */
export function knowledgeFingerprint(d: LiveDossier): string {
  const lit = d.literature?.length ?? 0;
  const pat = d.patents?.length ?? 0;
  const facts = d.processFacts?.facts?.length ?? 0;
  const routes = d.processRoutes?.length ?? 0;
  const steps = (d.processRoutes || []).reduce(
    (n, r) => n + (r.steps?.length || 0),
    0
  );
  const mfg = (d.manufacturingTexts || []).reduce((n, t) => n + t.length, 0);
  const rel = d.relatedEntities?.length ?? 0;
  const ann = d.annotations?.length ?? 0;
  const gen = d.generatedAt || "";
  return [
    d.cid,
    gen,
    lit,
    pat,
    facts,
    routes,
    steps,
    mfg,
    rel,
    ann,
    d.evidenceScore?.score ?? "",
    d.productMode || "",
  ].join("|");
}

/**
 * Return dossier with processKnowledge (+ idealParity) without rebuild when possible.
 */
export function ensureDossierKnowledge(d: LiveDossier): LiveDossier {
  const fp = knowledgeFingerprint(d);
  const existing = d.processKnowledge;
  if (existing?._fp === fp) {
    return d.idealParity ? d : { ...d, idealParity: assessIdealPageParity(d) };
  }

  const withIdeal = {
    ...d,
    idealParity: d.idealParity || assessIdealPageParity(d),
  };
  const pack = buildProcessKnowledgePackage(withIdeal);
  pack._fp = fp;
  return {
    ...withIdeal,
    processKnowledge: pack,
  };
}

/** True if package looks non-empty enough to answer science questions locally */
export function packageIsUsable(
  pack: ProcessKnowledgePackage | undefined | null
): boolean {
  if (!pack) return false;
  return (
    pack.metrics.observationCount > 0 ||
    pack.metrics.procedureChars > 80 ||
    pack.metrics.hypothesisCount > 0 ||
    (pack.reactionNetwork?.nodes.length ?? 0) > 1
  );
}
