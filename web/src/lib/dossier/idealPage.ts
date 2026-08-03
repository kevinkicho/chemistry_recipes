/**
 * Ideal page model — curated Tier-A ExampleDossierView is the depth goal.
 *
 * Live free-API builds chase this inventory without inventing plant numbers.
 * Fill status is honest: evidence | AI (grounded) | teaching (Tier-A) | empty.
 */

import type { LiveDossier } from "@/lib/dossier/types";

import type { ProcessRoute } from "@/lib/types/process";

export type IdealSectionId =
  | "identity"
  | "overview"
  | "applications"
  | "critical-params"
  | "process-recipe"
  | "route-compare"
  | "related-entities"
  | "manufacturing-summary"
  | "environment"
  | "apparatus"
  | "ehs"
  | "hazards"
  | "properties"
  | "sources";

export type IdealFillSource =
  | "empty"
  | "live-api"
  | "process-facts"
  | "ai"
  | "tier-a-teaching"
  | "user-local";

export type IdealSectionStatus = {
  id: IdealSectionId;
  /** Matches curated ExampleDossierView section intent */
  label: string;
  /** Why curated has this */
  idealNote: string;
  filled: boolean;
  /** 0–100 quality of fill toward curated depth */
  depth: number;
  source: IdealFillSource;
  detail: string;
  /** Scroll target on live page */
  scrollId?: string;
  /** How to densify toward ideal */
  howToClose?: string;
};

export type IdealPageParity = {
  /** 0–100 overall toward curated ideal */
  score: number;
  /** Sections that curated always aims to fill */
  sections: IdealSectionStatus[];
  filledCount: number;
  totalCount: number;
  summary: string;
  /** Hub twin with curated example (if any) */
  hubExampleId?: string;
  hubExampleHref?: string;
  /** Whether preferred route is Tier-A teaching */
  preferredIsTeaching: boolean;
  /** North-star product statement */
  goal: string;
};

const GOAL =
  "Goal: approach curated Tier-A dual-view depth (complete plant guide scaffold) " +
  "using free-public evidence + labeled teaching baselines — never invent site limits.";

function routeDepth(route: ProcessRoute | undefined): {
  depth: number;
  source: IdealFillSource;
  detail: string;
} {
  if (!route?.steps?.length) {
    return { depth: 0, source: "empty", detail: "No process steps yet" };
  }
  const steps = route.steps;
  const withCond = steps.filter(
    (s) =>
      s.conditions &&
      Object.values(s.conditions).some((v) => v && String(v).trim())
  ).length;
  const withApp = steps.filter((s) => s.apparatus && s.apparatus.length > 0).length;
  const withMech = steps.filter(
    (s) => s.mechanismNotes && s.mechanismNotes.length > 40
  ).length;
  const mats = route.materials?.length ?? 0;
  const isTeaching =
    /tier-a teaching|educational baseline/i.test(route.name || "") ||
    route.id.startsWith("tier-a-") ||
    (route.sourceRefs || []).some((r) => r.id?.includes("tier-a"));
  const isLitLead = steps.some((s) =>
    /literature process lead|patent process lead/i.test(s.mechanismClass || "")
  );

  let depth = Math.min(
    100,
    15 +
      steps.length * 12 +
      withCond * 10 +
      withApp * 8 +
      withMech * 6 +
      Math.min(20, mats * 4)
  );
  if (isLitLead && withCond === 0) depth = Math.min(depth, 35);
  if (isTeaching) depth = Math.max(depth, 70);

  const source: IdealFillSource = isTeaching
    ? "tier-a-teaching"
    : isLitLead
      ? "live-api"
      : withCond > 0
        ? "process-facts"
        : "ai";

  return {
    depth,
    source,
    detail: `${steps.length} steps · ${withCond} with conditions · ${mats} materials${
      isTeaching ? " · Tier-A teaching" : ""
    }`,
  };
}

function preferredRoute(d: LiveDossier): ProcessRoute | undefined {
  const routes = d.processRoutes || [];
  return (
    routes.find((r) => r.preference === 1) ||
    routes.slice().sort((a, b) => (a.preference || 99) - (b.preference || 99))[0]
  );
}

/**
 * Score how close a live dossier is to the curated ideal page inventory.
 */
export function assessIdealPageParity(dossier: LiveDossier): IdealPageParity {
  const pref = preferredRoute(dossier);
  const rd = routeDepth(pref);
  // Teaching-merge mock routes retired — preferred route is always live densify / AI.
  const preferredIsTeaching = false;

  const facts = (dossier.processFacts?.facts || []).filter(
    (f) => f.kind !== "open-gap"
  );
  const lit = dossier.literature?.length ?? 0;
  const patents = dossier.patents?.length ?? 0;

  const sections: IdealSectionStatus[] = [];

  // identity
  {
    const hit = dossier.identity;
    const filled = Boolean(hit?.name || dossier.cid);
    const depth = filled
      ? 40 +
        (hit?.cas ? 15 : 0) +
        (hit?.formula ? 10 : 0) +
        (hit?.smiles ? 10 : 0) +
        (hit?.inchiKey ? 15 : 0) +
        (hit?.molecularWeight != null ? 10 : 0)
      : 0;
    sections.push({
      id: "identity",
      label: "Identity & structure",
      idealNote: "Name, CAS, CID, formula, structure image",
      filled,
      depth: Math.min(100, depth),
      source: filled ? "live-api" : "empty",
      detail: hit?.name
        ? `${hit.name}${hit.cas ? ` · CAS ${hit.cas}` : ""} · CID ${dossier.cid}`
        : `CID ${dossier.cid}`,
      scrollId: "identity",
    });
  }

  // overview
  {
    const text =
      dossier.synthesis.overview || dossier.descriptionTexts?.[0] || "";
    const teaching = /Tier-A|teaching|Live build:/i.test(text);
    const filled = text.length >= 80;
    sections.push({
      id: "overview",
      label: "Overview prose",
      idealNote: "Process-aware narrative (not just chemical name)",
      filled,
      depth: filled ? Math.min(100, 30 + Math.floor(text.length / 8)) : 0,
      source: teaching
        ? "tier-a-teaching"
        : dossier.synthesis.parsed && dossier.synthesis.overview
          ? "ai"
          : filled
            ? "live-api"
            : "empty",
      detail: filled ? `${text.length} chars` : "Missing process overview",
      scrollId: "overview",
      howToClose: filled
        ? undefined
        : "Regenerate AI after densify, or open hub Tier-A twin if available",
    });
  }

  // applications
  {
    const apps = dossier.synthesis.applications || [];
    sections.push({
      id: "applications",
      label: "Applications tags",
      idealNote: "API / use-class chips",
      filled: apps.length > 0,
      depth: apps.length ? Math.min(100, apps.length * 25) : 0,
      source: apps.length
        ? dossier.synthesis.parsed
          ? "ai"
          : "tier-a-teaching"
        : "empty",
      detail: apps.length ? apps.slice(0, 4).join(" · ") : "None yet",
      scrollId: "overview",
      howToClose: "AI synthesis or Tier-A applications merge on hub CIDs",
    });
  }

  // critical params
  {
    let n = 0;
    for (const r of dossier.processRoutes || []) {
      for (const s of r.steps || []) {
        n += s.controls?.criticalParameters?.length || 0;
        n += s.controls?.holdPoints?.length || 0;
      }
    }
    sections.push({
      id: "critical-params",
      label: "Control points board",
      idealNote: "CPPs / holds from recipe (teaching or sourced)",
      filled: n > 0,
      depth: n ? Math.min(100, 20 + n * 15) : 0,
      source: n
        ? preferredIsTeaching
          ? "tier-a-teaching"
          : "ai"
        : "empty",
      detail: n ? `${n} control lines` : "No CPP/hold language yet",
      scrollId: "critical-board",
      howToClose:
        "Paste public procedure text or use Tier-A teaching route on hub molecules",
    });
  }

  // process recipe
  {
    sections.push({
      id: "process-recipe",
      label: "Process recipe (dual-view steps)",
      idealNote: "BOM + ordered unit ops + conditions + mechanism notes",
      filled: rd.depth >= 25,
      depth: rd.depth,
      source: rd.source,
      detail: rd.detail,
      scrollId: "routes",
      howToClose:
        rd.depth >= 70
          ? undefined
          : "Densify OA/patent examples → paste wizard → regenerate; hub CIDs can surface Tier-A teaching routes",
    });
  }

  // route compare
  {
    const n = dossier.processRoutes?.length ?? 0;
    sections.push({
      id: "route-compare",
      label: "Route compare",
      idealNote: "≥2 routes or clear single-path compare chrome",
      filled: n >= 1,
      depth: n >= 2 ? 90 : n === 1 ? 50 : 0,
      source: n ? (preferredIsTeaching ? "tier-a-teaching" : "live-api") : "empty",
      detail: `${n} route(s)`,
      scrollId: "route-compare",
    });
  }

  // related
  {
    const rel = dossier.relatedEntities || [];
    sections.push({
      id: "related-entities",
      label: "Related entities / multi-CID graph",
      idealNote: "SM, reagents, impurities with CAS/CID",
      filled: rel.length > 0,
      depth: rel.length ? Math.min(100, 20 + rel.length * 18) : 0,
      source: rel.length
        ? rel.some((e) => /Tier-A teaching/i.test(e.notes || ""))
          ? "tier-a-teaching"
          : "live-api"
        : "empty",
      detail: rel.length
        ? `${rel.length} entities · ${rel.filter((e) => e.pubchemCid).length} with CID`
        : "None extracted",
      scrollId: "related-entities",
      howToClose: "AI relatedEntities + densify chemical mentions + Tier-A merge",
    });
  }

  // manufacturing summary
  {
    const mfg =
      dossier.synthesis.manufacturingSummary ||
      dossier.manufacturingTexts?.[0] ||
      "";
    const teaching = /Tier-A teaching/i.test(mfg);
    sections.push({
      id: "manufacturing-summary",
      label: "Manufacturing summary",
      idealNote: "Plant narrative (equipment train, recovery, CQAs)",
      filled: mfg.length >= 60,
      depth: mfg.length ? Math.min(100, 25 + Math.floor(mfg.length / 10)) : 0,
      source: teaching
        ? "tier-a-teaching"
        : dossier.synthesis.manufacturingSummary
          ? "ai"
          : mfg
            ? "live-api"
            : "empty",
      detail: mfg ? `${mfg.length} chars` : "Empty",
      scrollId: "manufacturing",
      howToClose: "PubChem Use & Manufacturing + densify + AI or Tier-A narrative",
    });
  }

  // environment
  {
    const env = dossier.synthesis.environmentBaseline;
    const filled = Boolean(
      env &&
        (env.atmosphere ||
          env.containment ||
          env.atexZone ||
          (env.utilities && env.utilities.length) ||
          env.notes)
    );
    const teaching = /Tier-A teaching/i.test(env?.notes || "");
    sections.push({
      id: "environment",
      label: "Plant environment baseline",
      idealNote: "Atmosphere, containment, utilities, zoning notes",
      filled,
      depth: filled
        ? 40 +
          (env?.atmosphere ? 15 : 0) +
          (env?.utilities?.length ? 20 : 0) +
          (env?.atexZone ? 15 : 0)
        : 0,
      source: filled ? (teaching ? "tier-a-teaching" : "ai") : "empty",
      detail: filled
        ? [env?.atmosphere, env?.containment].filter(Boolean).join(" · ") ||
          "Partial environment"
        : "Empty — site fill for plant truth",
      scrollId: "environment",
      howToClose: "AI env baseline or Tier-A teaching; site QMS owns real zoning",
    });
  }

  // apparatus
  {
    const app = dossier.synthesis.apparatusCatalog || [];
    const teaching = app.some((a) => /Tier-A teaching/i.test(a.notes || ""));
    sections.push({
      id: "apparatus",
      label: "Apparatus catalog",
      idealNote: "Equipment classes + MoC hints",
      filled: app.length > 0,
      depth: app.length ? Math.min(100, 25 + app.length * 12) : 0,
      source: app.length
        ? teaching
          ? "tier-a-teaching"
          : facts.some((f) => f.kind === "unit-op")
            ? "process-facts"
            : "ai"
        : "empty",
      detail: app.length
        ? app.map((a) => a.equipmentClass).slice(0, 5).join(" · ")
        : "No equipment classes derived",
      scrollId: "apparatus",
      howToClose: "Unit-op facts → plant deliverables mapping; or Tier-A catalog",
    });
  }

  // ehs
  {
    const ehs =
      dossier.synthesis.ehsHighlights?.length
        ? dossier.synthesis.ehsHighlights
        : dossier.hazards.hazardStatements?.slice(0, 4) || [];
    const teaching = (dossier.synthesis.ehsHighlights || []).some((e) =>
      /Tier-A teaching/i.test(e)
    );
    sections.push({
      id: "ehs",
      label: "EHS highlights",
      idealNote: "Process-specific EHS bullets (not only GHS list)",
      filled: ehs.length > 0,
      depth: ehs.length
        ? Math.min(
            100,
            30 +
              ehs.length * 15 +
              (dossier.synthesis.ehsHighlights?.length ? 20 : 0)
          )
        : 0,
      source: ehs.length
        ? teaching
          ? "tier-a-teaching"
          : dossier.synthesis.ehsHighlights?.length
            ? "ai"
            : "live-api"
        : "empty",
      detail: ehs.length ? `${ehs.length} bullets` : "None",
      scrollId: "ehs",
    });
  }

  // hazards
  {
    const hz = dossier.hazards.hazardStatements?.length ?? 0;
    sections.push({
      id: "hazards",
      label: "Hazards (GHS summary)",
      idealNote: "Signal word + H-statements from public sources",
      filled: hz > 0,
      depth: hz ? Math.min(100, 40 + hz * 8) : 0,
      source: hz ? "live-api" : "empty",
      detail: hz
        ? `${hz} statements${dossier.hazards.signalWord ? ` · ${dossier.hazards.signalWord}` : ""}`
        : "No GHS text for this CID",
      scrollId: "hazards",
    });
  }

  // properties
  {
    const props =
      (dossier.identity?.molecularWeight != null ? 1 : 0) +
      (dossier.propertyTexts?.length ? 1 : 0) +
      (dossier.identity?.formula ? 1 : 0);
    sections.push({
      id: "properties",
      label: "Properties card",
      idealNote: "MW, mp, appearance, solubility when public",
      filled: props > 0,
      depth: props ? Math.min(100, props * 30) : 0,
      source: props ? "live-api" : "empty",
      detail: dossier.propertyTexts?.length
        ? `${dossier.propertyTexts.length} property texts`
        : dossier.identity?.molecularWeight != null
          ? `MW ${dossier.identity.molecularWeight}`
          : "Sparse",
      scrollId: "properties",
    });
  }

  // sources
  {
    const n = (dossier.sourceRefs?.length ?? 0) + (dossier.traces?.length ?? 0);
    sections.push({
      id: "sources",
      label: "Sources & provenance",
      idealNote: "Deeplinks + API traces (live is stronger than curated here)",
      filled: n > 0 || lit + patents > 0,
      depth: Math.min(100, 20 + lit * 2 + patents * 3 + Math.min(40, n)),
      source: n || lit || patents ? "live-api" : "empty",
      detail: `${lit} lit · ${patents} patents · ${dossier.traces?.length ?? 0} HTTP traces`,
      scrollId: "sources",
    });
  }

  const totalCount = sections.length;
  const filledCount = sections.filter((s) => s.filled).length;
  // Weight process-recipe and manufacturing heavily (curated soul)
  const weights: Partial<Record<IdealSectionId, number>> = {
    "process-recipe": 2.5,
    "manufacturing-summary": 1.5,
    apparatus: 1.3,
    environment: 1.2,
    overview: 1.2,
    "related-entities": 1.1,
    ehs: 1.1,
  };
  let wSum = 0;
  let wScore = 0;
  for (const s of sections) {
    const w = weights[s.id] ?? 1;
    wSum += w;
    wScore += w * s.depth;
  }
  const score = Math.round(wScore / wSum);

  const weak = sections
    .filter((s) => s.depth < 45)
    .slice(0, 4)
    .map((s) => s.label);

  const summary =
    score >= 75
      ? `Near ideal depth (${score}/100) — still educational, not GMP.`
      : score >= 50
        ? `Mid-path to curated ideal (${score}/100). Strengthen: ${weak.join(", ") || "—"}.`
        : `Early scout vs curated ideal (${score}/100). Priority: ${weak.join(", ") || "process recipe"}.`;

  return {
    score,
    sections,
    filledCount,
    totalCount,
    summary,
    hubExampleId: undefined,
    hubExampleHref: undefined,
    preferredIsTeaching,
    goal: GOAL,
  };
}

/** Attach parity snapshot onto a live dossier (client or pipeline). */
export function withIdealPageParity(dossier: LiveDossier): LiveDossier {
  return {
    ...dossier,
    idealParity: assessIdealPageParity(dossier),
  };
}

/**
 * Is the preferred live route "thin" relative to curated ideal?
 * Used to promote Tier-A teaching routes on hub CIDs.
 */
export function isPreferredRouteThin(dossier: LiveDossier): boolean {
  const pref = preferredRoute(dossier);
  if (!pref) return true;
  if (pref.id.startsWith("tier-a-")) return false;
  const rd = routeDepth(pref);
  if (rd.depth < 45) return true;
  const steps = pref.steps || [];
  if (steps.length === 0) return true;
  const litLead = steps.every((s) =>
    /literature process lead|patent process lead|scaffold/i.test(
      `${s.mechanismClass || ""} ${s.title || ""}`
    )
  );
  if (litLead) return true;
  const withCond = steps.filter(
    (s) =>
      s.conditions &&
      Object.values(s.conditions).some((v) => v && String(v).trim())
  ).length;
  return withCond === 0 && steps.length < 3;
}
