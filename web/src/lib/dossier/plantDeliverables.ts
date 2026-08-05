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
  ProcessStep,
  RelatedEntity,
} from "@/lib/types/process";
import { filterUsefulTexts } from "@/lib/dossier/evidenceFilter";
import {
  evidenceTextBlob,
  extractChemicalMentions,
  materialsFromMentions,
} from "@/lib/dossier/chemicalMentions";
import { mergeRelatedEntities } from "@/lib/dossier/relatedEntities";

const UNIT_OP_TO_EQUIPMENT: Array<{
  re: RegExp;
  equipmentClass: string;
  notes: string;
}> = [
  { re: /hydrogenat/i, equipmentClass: "hydrogenator", notes: "From public unit-op language" },
  { re: /crystall/i, equipmentClass: "crystallizer", notes: "From public unit-op language" },
  { re: /filtr|filter/i, equipmentClass: "filter-dryer", notes: "Filtration / drying language in sources" },
  { re: /centrifug/i, equipmentClass: "centrifuge", notes: "From public unit-op language" },
  { re: /distill/i, equipmentClass: "distillation-column", notes: "From public unit-op language" },
  { re: /ferment/i, equipmentClass: "ss316-reactor", notes: "Fermentation / bioreactor class (educational)" },
  { re: /dry|drying/i, equipmentClass: "drying-oven", notes: "Drying language in sources" },
  { re: /mill/i, equipmentClass: "milling", notes: "From public unit-op language" },
  {
    re: /chromatograph/i,
    equipmentClass: "other",
    notes: "Chromatography / purification (class TBD on site)",
  },
  {
    re: /react|charge|quench|acylation|alkylat|acetylation/i,
    equipmentClass: "glass-lined-reactor",
    notes: "Reaction language in public text",
  },
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
  if (facts.some((f) => /N2|nitrogen|inert|argon/i.test(f.claim + (f.value || "")))) {
    if (!seen.has("nitrogen-blanket")) {
      out.push({
        equipmentClass: "nitrogen-blanket",
        notes: "Atmosphere language in public sources",
        required: false,
      });
    }
  }
  if (facts.some((f) => /exotherm|scrubber|acid vapor/i.test(f.claim))) {
    if (!seen.has("scrubber")) {
      out.push({
        equipmentClass: "scrubber",
        notes: "Process-hazard / acid-gas cue in public text",
      });
    }
  }
  return out.slice(0, 12);
}

function equipmentForUnitOp(op: string): ApparatusItem[] {
  const out: ApparatusItem[] = [];
  for (const m of UNIT_OP_TO_EQUIPMENT) {
    if (m.re.test(op)) {
      out.push({ equipmentClass: m.equipmentClass, notes: m.notes });
    }
  }
  return out.slice(0, 2);
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

function deriveMaterialsFromFacts(facts: ProcessFact[]): Material[] {
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

/**
 * Coherent plant-train narrative (example-like), not raw excerpt dump.
 */
function deriveManufacturingSummary(d: LiveDossier, facts: ProcessFact[]): string | undefined {
  if (
    d.synthesis.manufacturingSummary?.trim() &&
    !/legacy mock|tier-a teaching/i.test(d.synthesis.manufacturingSummary)
  ) {
    // Prefer non-tier-a live summary if already good
    if (d.synthesis.manufacturingSummary.length > 80) {
      return d.synthesis.manufacturingSummary;
    }
  }

  const name = d.identity?.name || `CID ${d.cid}`;
  const ops = [
    ...new Set(
      facts
        .filter((f) => f.kind === "unit-op")
        .map((f) => (f.value || f.unitOp || "").toLowerCase())
        .filter(Boolean)
    ),
  ].slice(0, 8);

  const temps = facts
    .filter((f) => f.kind === "condition" && /°\s*c|temp/i.test(f.claim))
    .map((f) => f.value || f.claim)
    .slice(0, 4);
  const isolation = facts.some((f) => f.kind === "isolation" || f.kind === "workup");
  const mfg = filterUsefulTexts(d.manufacturingTexts).slice(0, 2);
  const lit = d.literature[0]?.title;
  const pat = d.patents[0]?.title;

  const train =
    ops.length > 0
      ? `Public process cues for ${name} suggest a train involving: ${ops.join(" → ")}.`
      : `Public process sequence for ${name} is not yet dense enough to sketch a full unit-op train.`;

  const condBit = temps.length
    ? ` Conditions mentioned in free-public text include ${temps.join("; ")} (verify in primary sources).`
    : "";
  const isolBit = isolation
    ? " Isolation / workup language appears in sources."
    : " Isolation details are largely site-fill from public excerpts.";
  const mfgBit = mfg.length ? ` PubChem manufacturing/use notes: ${mfg.join(" ")}` : "";
  const leadBit = [
    lit ? `Process-oriented literature lead: “${lit.slice(0, 90)}”.` : null,
    pat ? `IP lead: “${pat.slice(0, 90)}”.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const framing =
    d.processFacts?.framing === "process-recipe"
      ? " Process-fact density supports process-recipe framing (still not GMP)."
      : " Currently framed as an evidence-lead pack — not a full manufacturing recipe.";

  const s = `${train}${condBit}${isolBit}${mfgBit} ${leadBit}${framing}`.replace(
    /\s+/g,
    " "
  ).trim();
  return s.length > 60 ? s.slice(0, 1400) : undefined;
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

/**
 * Enrich thin evidence-lead steps with plant apparatus + dual-view body.
 */
function enrichStepsForPlantView(
  routes: ProcessRoute[],
  facts: ProcessFact[]
): ProcessRoute[] {
  return routes.map((r) => ({
    ...r,
    steps: r.steps.map((s) => enrichOneStep(s, facts)),
  }));
}

function enrichOneStep(step: ProcessStep, allFacts: ProcessFact[]): ProcessStep {
  const related = (step.factIds || [])
    .map((id) => allFacts.find((f) => f.id === id))
    .filter(Boolean) as ProcessFact[];
  const unitOps = related
    .filter((f) => f.kind === "unit-op")
    .map((f) => f.value || f.unitOp || "")
    .filter(Boolean);
  const apparatus =
    step.apparatus?.length
      ? step.apparatus
      : unitOps.flatMap((op) => equipmentForUnitOp(op)).slice(0, 3);

  // Build plant-facing description if step is still a raw abstract dump
  let description = step.description;
  const isLead =
    /literature process lead|patent process lead|open primary source/i.test(
      step.mechanismClass || ""
    ) || description.length > 400;
  if (unitOps.length && (isLead || !step.apparatus?.length)) {
    const plantLead = [
      unitOps.length ? `Plant unit-op cues: ${unitOps.join(", ")}.` : null,
      step.conditions?.temperatureC
        ? `Temperature in public text: ${step.conditions.temperatureC}.`
        : null,
      step.conditions?.time ? `Time in public text: ${step.conditions.time}.` : null,
      step.conditions?.atmosphere
        ? `Atmosphere: ${step.conditions.atmosphere}.`
        : null,
      "Verify full experimental procedure in the primary source before any plant use.",
    ]
      .filter(Boolean)
      .join(" ");
    // Keep original abstract as mechanism notes if not set
    const mechanismNotes =
      step.mechanismNotes ||
      (description.length > 40 ? description.slice(0, 500) : undefined);
    description = plantLead;
    return {
      ...step,
      description,
      mechanismNotes,
      apparatus: apparatus.length ? apparatus : step.apparatus,
      environment:
        step.environment ||
        (step.conditions?.atmosphere
          ? { atmosphere: step.conditions.atmosphere }
          : undefined),
    };
  }

  return {
    ...step,
    apparatus: apparatus.length ? apparatus : step.apparatus,
  };
}

function enrichRoutesWithMaterials(
  routes: ProcessRoute[],
  materials: Material[]
): ProcessRoute[] {
  if (!materials.length) return routes;
  return routes.map((r, i) => {
    if (r.materials?.length) return r;
    if (i === 0) return { ...r, materials: [...materials] };
    return r;
  });
}

/**
 * Ensure live dossiers always carry example-like plant sections when free data allows.
 */
export function applyPlantDeliverables(dossier: LiveDossier): LiveDossier {
  const facts = factsOf(dossier);
  const blob = evidenceTextBlob({
    manufacturingTexts: dossier.manufacturingTexts,
    literature: dossier.literature,
    patents: dossier.patents,
    processFactQuotes: facts.map((f) => f.quote || f.claim).slice(0, 40),
  });
  const mentions = extractChemicalMentions(blob, {
    excludeName: dossier.identity?.name,
  });
  const mentionMaterials = materialsFromMentions(mentions);
  const factMaterials = deriveMaterialsFromFacts(facts);
  const materials = [...factMaterials, ...mentionMaterials].slice(0, 16);

  const relatedFromMentions: RelatedEntity[] = mentions;
  const relatedEntities = mergeRelatedEntities(
    dossier.relatedEntities || [],
    relatedFromMentions
  );

  const apparatus =
    dossier.synthesis.apparatusCatalog?.length
      ? dossier.synthesis.apparatusCatalog
      : deriveApparatus(facts);
  const environment =
    dossier.synthesis.environmentBaseline || deriveEnvironment(facts);
  const applications = deriveApplications(dossier);
  const manufacturingSummary = deriveManufacturingSummary(dossier, facts);
  const ehsHighlights = deriveEhs(dossier, facts);

  let processRoutes = enrichRoutesWithMaterials(dossier.processRoutes, materials);
  processRoutes = enrichStepsForPlantView(processRoutes, facts);

  return {
    ...dossier,
    processRoutes,
    relatedEntities,
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
