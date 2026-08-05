/**
 * One-shot scanner: dossier/workspace panels that show free-public or AI content
 * but lack ContentProvenance / ApiProvenance / AiProvenance.
 * Run: node scripts/scan-provenance-gaps.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..", "src");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const DATA_HINT =
  /LiveDossier|dossier\.|processFacts|processRoutes|literature|patents|annotations|synthesis|evidenceScore|processKnowledge|conditionAtlas|routeHypothes|campaign|densify|ScoreVector|ProcedureExcerpt|ManufacturingText|SourceCoverage|EntityGraph|RouteCompare|parameterSet|unitOpFill|ValidationChecklist|SiteFill|LocalTextEnrich|IdealPage|WorkerPlaybook|ScienceAgent|CampaignAgent|CampaignBrief|ReactionNetwork|EvidenceScience|BatchDensify|OrdBulk|multi-source|MultiSource/i;

const PROV =
  /ContentProvenance|ApiProvenance|AiProvenance|FreePublicProvenance|FreePublicBadge/;

// Pure chrome / auth / layout — skip
const SKIP =
  /AiSettings|Auth|GoogleSignIn|Header|Footer|Tooltip|CollapsibleSection|ViewToggle|TierBadge|ConfidenceBadge|HistorySidebar|HistoryTracker|SearchForm|SearchResults\.tsx|PrintExport|AddToProject|DossierSnapshots|FieldRegenerate|AiAccuracy|AiStatus|EnvChecklist|SourcesRegistry|RegulatoryDisclaimer|TableOfContents|ContentProvenance|ApiProvenance|AiProvenance|FreePublicProvenance|DossierSectionTitle|DossierClientLoader|ApiProgressOverlay|buildMfgTableRows|EvidenceDataTable|LiteratureTable|PatentsTable|ManufacturingTextTable|SiteFillPanel|SiteGapsExport|WorkPackPanel|DensifyTelemetry|DensifySchedule|OrdBulk|ProblemFirstSearch|TechTransferExport|DossierDiagnostics|EntityGraph|WorkspaceScienceIndex/;

const files = walk(join(root, "components"));
const gaps = [];
const ok = [];

for (const f of files) {
  const rel = relative(join(root), f).replace(/\\/g, "/");
  if (SKIP.test(rel)) continue;
  const body = readFileSync(f, "utf8");
  if (!DATA_HINT.test(body)) continue;
  // Prefer panel/card-ish exports
  if (!/export function|export default function/.test(body)) continue;
  if (PROV.test(body)) ok.push(rel);
  else gaps.push(rel);
}

console.log("=== WITH provenance ===", ok.length);
ok.forEach((r) => console.log("  ok ", r));
console.log("\n=== GAPS (data + no provenance) ===", gaps.length);
gaps.forEach((r) => console.log("  GAP", r));
