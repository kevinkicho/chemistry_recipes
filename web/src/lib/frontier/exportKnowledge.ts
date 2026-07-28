/**
 * Download process-knowledge.v1 JSON for agents / notebooks.
 */

import type { ProcessKnowledgePackage } from "@/lib/frontier/types";
import type { LiveDossier } from "@/lib/dossier/types";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";

export function downloadProcessKnowledge(
  dossier: LiveDossier,
  pack?: ProcessKnowledgePackage
): void {
  const data = pack || dossier.processKnowledge || buildProcessKnowledgePackage(dossier);
  const name = (dossier.identity?.name || `cid-${dossier.cid}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 48);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `process-knowledge-${name}-${dossier.cid}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
