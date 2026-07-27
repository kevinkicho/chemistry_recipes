import type { LiveDossier } from "@/lib/dossier/types";
import type { MfgTextRow } from "@/components/ManufacturingTextTable";

/**
 * Structured rows for manufacturing table (sort / filter / click).
 * Primary: PubChem use/manufacturing texts; thin fallbacks from description,
 * process facts, and process-ish literature.
 */
export function buildMfgTableRows(dossier: LiveDossier): MfgTextRow[] {
  const cid = dossier.cid;
  const pubchemMfgHref = `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Use-and-Manufacturing`;
  const rows: MfgTextRow[] = [];
  let n = 0;
  const push = (row: Omit<MfgTextRow, "id" | "chars">) => {
    const text = row.text.trim();
    if (!text || text.length < 12) return;
    rows.push({
      ...row,
      text,
      id: `mfg-${n++}`,
      chars: text.length,
    });
  };

  for (const t of dossier.manufacturingTexts ?? []) {
    const isUse = /\buse\b|application|indication|consumer|industrial use/i.test(t);
    push({
      kind: isUse ? "use" : "manufacturing",
      source: "PubChem PUG View",
      text: t,
      href: pubchemMfgHref,
    });
  }

  if (rows.length < 3) {
    for (const t of (dossier.descriptionTexts ?? []).slice(0, 8)) {
      push({
        kind: "description",
        source: "PubChem description",
        text: t,
        href: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      });
    }
    for (const f of dossier.processFacts?.facts ?? []) {
      if (
        !["condition", "unit-op", "isolation", "workup", "scale-note"].includes(
          f.kind
        )
      ) {
        continue;
      }
      const bits = [
        f.claim,
        f.value && f.unit ? `${f.value} ${f.unit}` : f.value,
        f.quote,
      ]
        .filter(Boolean)
        .join(" — ");
      push({
        kind: "process-fact",
        source: f.sourceLabel || "Process fact",
        text: bits || f.claim,
        href: f.sourceUrl,
      });
    }
    for (const h of dossier.literature ?? []) {
      if (
        !/synthes|manufactur|process|preparat|industrial|scale/i.test(
          `${h.title} ${h.abstract || ""}`
        )
      ) {
        continue;
      }
      push({
        kind: "literature",
        source: [h.journal, h.year].filter(Boolean).join(" · ") || "Literature",
        text: h.abstract
          ? `${h.title} — ${h.abstract.slice(0, 280)}${h.abstract.length > 280 ? "…" : ""}`
          : h.title,
        href: h.url,
      });
    }
  }

  return rows.slice(0, 48);
}
