/**
 * Fill example-like plant sections from free-public evidence when AI does not.
 * Only maps unit-ops → equipment classes and public text — no invented CPPs.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import type {
  ApparatusItem,
  EnvironmentSpec,
  Material,
  ProcessRoute,
} from "@/lib/types/process";
import { filterUsefulTexts } from "@/lib/dossier/evidenceFilter";

const UNIT_OP_TO_EQUIPMENT: Array<{ re: RegExp; equipmentClass: string; notes: string }> = [
  { re: /hydrogenat/i, equipmentClass: "hydrogenator", notes: "From public unit-op language" },
  { re: /crystall/i, equipmentClass: "crystallizer", notes: "From public unit-op language" },
  { re: /filtr|filter/i, equipmentClass: "filter-dryer", notes: "Filtration / drying language in sources" },
  { re: /centrifug/i, equipmentClass: "centrifuge", notes: "From public unit-op language" },
  { re: /distill/i, equipmentClass: "distillation-column", notes: "From public unit-op language" },
  { re: /ferment/i, equipmentClass: "ss316-reactor", notes: "Fermentation / bioreactor class (educational)" },
  { re: /dry|drying/i, equipmentClass: "drying-oven", notes: "Drying language in sources" },
  { re: /mill/i, equipmentClass: "milling", notes: "From public unit-op language" },
  { re: /chromatograph/i, equipmentClass: "other", notes: "Chromatography / purification (class TBD on site)" },
  { re: /react|charge|quench|acylation|alkylat/i, equipmentClass: "glass-lined-reactor", notes: "Reaction language in public text" },
];

function factsOf(d: LiveDossier): ProcessFact[] {
  return (d.processFacts?.facts || []).filter((f) => f.kind !== "open-gap");
}

function deriveApparatus(facts: ProcessFact[]): ApparatusItem[] {
  const seen = new Set<string>();
  const out: ApparatusItem[] = [];
  for (const f of facts.filter((x) => x.kind === "unit-op" || x.unitOp)) {
    const blob = `${f.value || ""} ${f.claim} ${f.unitOp || ""}`;
    for (const m of UNIT_OP_TO_EQUIPMENT) {
      if (m.re.test(blob) && !seen.has(m.equipmentClass)) {
        seen.add(m.equipmentClass);
        out.push({
          equipmentClass: m.equipmentClass,
          notes: `${m.notes}${f.sourceLabel ? ` · ${f.sourceLabel}` : ""}`,
          required: false,
        });
      }
    }
  }
  // Always suggest N2 blanket if atmosphere language present
  if (facts.some((f) => /N2|nitrogen|inert|argon/i.test(f.claim + (f.value || "")))) {
    if (!seen.has("nitrogen-blanket")) {
      out.push({
        equipmentClass: "nitrogen-blanket",
        notes: "Atmosphere language in public sources",
        required: false,
      });
    }
  }
  return out.slice(0, 12);
}

function deriveEnvironment(facts: ProcessFact[]): EnvironmentSpec | undefined {
  const atm = facts.find(
    (f) =>
      f.kind === "condition" &&
      /N2|nitrogen|argon|inert|hydrogen|H2|air/i.test(f.claim + (f.value || ""))
  );
  const hazards = facts.filter((f) => f.kind === "hazard-process");
  const scale = facts.filter((f) => f.kind === "scale-note");
  if (!atm && !hazards.length && !scale.length) return undefined;

  const utilities: string[] = [];
  if (atm) utilities.push("Plant nitrogen / inert gas (if atmosphere claimed in source)");
  if (hazards.some((h) => /exotherm|scrubber|acid/i.test(h.claim))) {
    utilities.push("Cooling / scrubber capacity (site design)");
  }
  if (facts.some((f) => /vacuum|distill/i.test(f.claim))) {
    utilities.push("Vacuum system");
  }

  return {
    atmosphere: atm ? String(atm.value || atm.claim) : undefined,
    containment: hazards.length
      ? "Review public process-hazard cues; site containment per SDS/QMS"
      : undefined,
    utilities: utilities.length ? utilities : undefined,
    notes: [
      "Environment cues derived only from free-public text — not a plant design basis.",
      ...scale.map((s) => s.claim).slice(0, 3),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function deriveMaterials(facts: ProcessFact[]): Material[] {
  const out: Material[] = [];
  for (const f of facts.filter((x) => x.kind === "material")) {
    out.push({
      role: "reagent",
      name: f.claim.replace(/^Stoichiometry:\s*/i, "").slice(0, 80),
      stoich: f.value,
      notes: f.sourceLabel ? `Public text · ${f.sourceLabel}` : "Public text",
    });
  }
  return out.slice(0, 12);
}

function deriveApplications(d: LiveDossier): string[] {
  if (d.synthesis.applications?.length) return d.synthesis.applications;
  const fromAnn = (d.annotations || [])
    .filter((a) => a.kind === "regulatory" || a.kind === "identity")
    .map((a) => a.title)
    .slice(0, 4);
  const mfg = filterUsefulTexts(d.manufacturingTexts).filter((t) =>
    /use|indication|analges|anti|drug|supplement|industrial/i.test(t)
  );
  const chips = mfg
    .map((t) => t.replace(/^[^:]+:\s*/, "").slice(0, 80))
    .filter((t) => t.length > 8)
    .slice(0, 6);
  return [...new Set([...fromAnn, ...chips])].slice(0, 8);
}

function deriveManufacturingSummary(d: LiveDossier): string | undefined {
  if (d.synthesis.manufacturingSummary?.trim()) return d.synthesis.manufacturingSummary;
  const mfg = filterUsefulTexts(d.manufacturingTexts).slice(0, 4);
  const factBit = d.processFacts?.summary;
  const lit = d.literature[0]?.title;
  const pat = d.patents[0]?.title;
  const parts = [
    mfg.join(" "),
    factBit,
    lit ? `Process-oriented literature includes “${lit.slice(0, 100)}”.` : null,
    pat ? `Related IP includes “${pat.slice(0, 100)}”.` : null,
  ].filter(Boolean);
  const s = parts.join(" ").trim();
  return s.length > 40 ? s.slice(0, 1200) : undefined;
}

function deriveEhs(d: LiveDossier, facts: ProcessFact[]): string[] {
  if (d.synthesis.ehsHighlights?.length) return d.synthesis.ehsHighlights;
  const ghs = d.hazards.hazardStatements?.slice(0, 8) || [];
  const proc = facts
    .filter((f) => f.kind === "hazard-process" && f.provenance !== "ghs")
    .map((f) => f.claim)
    .slice(0, 6);
  return [...proc, ...ghs].slice(0, 12);
}

function enrichRoutesWithMaterials(
  routes: ProcessRoute[],
  materials: Material[]
): ProcessRoute[] {
  if (!materials.length) return routes;
  return routes.map((r, i) => {
    if (r.materials?.length) return r;
    // Attach derived materials only to preferred route
    if (i === 0) return { ...r, materials: [...materials] };
    return r;
  });
}

/**
 * Ensure live dossiers always carry example-like plant sections when free data allows.
 */
export function applyPlantDeliverables(dossier: LiveDossier): LiveDossier {
  const facts = factsOf(dossier);
  const apparatus =
    dossier.synthesis.apparatusCatalog?.length
      ? dossier.synthesis.apparatusCatalog
      : deriveApparatus(facts);
  const environment =
    dossier.synthesis.environmentBaseline || deriveEnvironment(facts);
  const materials = deriveMaterials(facts);
  const applications = deriveApplications(dossier);
  const manufacturingSummary = deriveManufacturingSummary(dossier);
  const ehsHighlights = deriveEhs(dossier, facts);
  const processRoutes = enrichRoutesWithMaterials(dossier.processRoutes, materials);

  return {
    ...dossier,
    processRoutes,
    synthesis: {
      ...dossier.synthesis,
      applications: applications.length ? applications : dossier.synthesis.applications,
      manufacturingSummary:
        manufacturingSummary || dossier.synthesis.manufacturingSummary,
      apparatusCatalog: apparatus.length ? apparatus : dossier.synthesis.apparatusCatalog,
      environmentBaseline: environment || dossier.synthesis.environmentBaseline,
      ehsHighlights: ehsHighlights.length
        ? ehsHighlights
        : dossier.synthesis.ehsHighlights,
    },
  };
}
