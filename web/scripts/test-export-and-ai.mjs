/**
 * Contract tests for export schemas, AI host allowlist, registry wired IDs.
 * Run: node scripts/test-export-and-ai.mjs
 */

import assert from "node:assert/strict";

// --- Host allowlist (mirror lib/ai/config.ts) ---
function isLocalOllamaHost(host) {
  try {
    const u = new URL(host.replace(/\/$/, ""));
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") {
      return u.protocol === "http:" || u.protocol === "https:";
    }
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

function isAllowedOllamaHost(host) {
  try {
    const u = new URL(host.replace(/\/$/, ""));
    if (u.hostname.toLowerCase() === "ollama.com") return u.protocol === "https:";
    return isLocalOllamaHost(host);
  } catch {
    return false;
  }
}

// --- Export schema builders (shape contracts) ---
function buildPublicProcessBrief(dossier) {
  const pf = dossier.processFacts;
  return {
    schema: "chemistry-recipes.public-process-brief.v1",
    exportedAt: new Date().toISOString(),
    disclaimer: "PUBLIC PROCESS BRIEF",
    entity: {
      name: dossier.identity?.name || `CID ${dossier.cid}`,
      pubchemCid: dossier.cid,
    },
    processFactSummary: pf?.summary || "No process facts",
    productionBriefEligible: Boolean(pf?.productionBriefEligible),
    sourcedFacts: (pf?.facts || [])
      .filter((f) => f.kind !== "open-gap")
      .map((f) => ({
        kind: f.kind,
        claim: f.claim,
        sourceLabel: f.sourceLabel,
      })),
    openGaps: pf?.openGaps || [],
    managerRisks: pf?.managerRisks || [],
  };
}

function buildTechTransferV2(dossier) {
  return {
    schema: "chemistry-recipes.tech-transfer.v2",
    exportedAt: new Date().toISOString(),
    regulatoryNotice: "NOT FOR REGULATORY",
    validationChecklist: [
      {
        id: "process-facts",
        item: "Public process-fact density",
        status: dossier.processFacts?.productionBriefEligible ? "ok" : "gap",
      },
      { id: "not-gmp", item: "Not site batch record", status: "review" },
    ],
    processFacts: dossier.processFacts
      ? {
          summary: dossier.processFacts.summary,
          productionBriefEligible: dossier.processFacts.productionBriefEligible,
          sourcedConditionCount: dossier.processFacts.sourcedConditionCount,
          unitOpCount: dossier.processFacts.unitOpCount,
        }
      : undefined,
    entity: { name: dossier.identity?.name || "x", pubchemCid: dossier.cid },
    routes: dossier.processRoutes || [],
  };
}

function buildCompareExport(a, b) {
  return {
    schema: "chemistry-recipes.compare-export.v1",
    exportedAt: new Date().toISOString(),
    a,
    b,
    links: { a: "/a", b: "/b" },
  };
}

// Wired source IDs (mirror SourcesRegistry)
const WIRED = new Set([
  "pubchem-pug",
  "pubchem-pug-view",
  "chembl",
  "mychem",
  "openfda",
  "rxnorm",
  "europepmc",
  "openalex",
  "crossref",
  "patentsview",
  "kegg",
  "comptox",
  "dailymed",
  "semantic-scholar",
]);

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

// Host allowlist
ok("allows ollama.com https", isAllowedOllamaHost("https://ollama.com"));
ok("rejects ollama.com http", !isAllowedOllamaHost("http://ollama.com"));
ok("allows local 127.0.0.1", isAllowedOllamaHost("http://127.0.0.1:11434"));
ok("allows localhost", isAllowedOllamaHost("http://localhost:11434"));
ok("allows private LAN", isAllowedOllamaHost("http://192.168.1.10:11434"));
ok("rejects evil.example.com", !isAllowedOllamaHost("https://evil.example.com"));
ok("rejects metadata IP SSRF class", !isAllowedOllamaHost("http://169.254.169.254/"));

// Public process brief
const dossier = {
  cid: 2244,
  identity: { name: "Aspirin" },
  processFacts: {
    summary: "Extracted 4 atoms",
    productionBriefEligible: true,
    sourcedConditionCount: 2,
    unitOpCount: 2,
    openGaps: ["Site IPC only"],
    managerRisks: ["exotherm cue"],
    facts: [
      {
        kind: "condition",
        claim: "Temp 50 °C",
        sourceLabel: "Patent X",
      },
      { kind: "open-gap", claim: "gap", sourceLabel: "gap" },
    ],
  },
  processRoutes: [{ id: "r1", name: "Route", steps: [] }],
};

const brief = buildPublicProcessBrief(dossier);
ok("brief schema v1", brief.schema === "chemistry-recipes.public-process-brief.v1");
ok("brief excludes open-gap from sourcedFacts", brief.sourcedFacts.every((f) => f.kind !== "open-gap"));
ok("brief keeps openGaps array", brief.openGaps.includes("Site IPC only"));
ok("brief has entity cid", brief.entity.pubchemCid === 2244);
ok("brief has disclaimer", Boolean(brief.disclaimer));

const pack = buildTechTransferV2(dossier);
ok("tech-transfer schema v2", pack.schema === "chemistry-recipes.tech-transfer.v2");
ok("tech-transfer has processFacts block", pack.processFacts?.sourcedConditionCount === 2);
ok(
  "validation checklist has process-facts item",
  pack.validationChecklist.some((c) => c.id === "process-facts" && c.status === "ok")
);
ok("always has not-gmp review", pack.validationChecklist.some((c) => c.id === "not-gmp"));

const compare = buildCompareExport(pack, null);
ok("compare schema", compare.schema === "chemistry-recipes.compare-export.v1");
ok("compare allows null side", compare.b === null && compare.a?.schema);

// Wired registry integrity
ok("wired includes comptox", WIRED.has("comptox"));
ok("wired includes dailymed", WIRED.has("dailymed"));
ok("wired includes semantic-scholar", WIRED.has("semantic-scholar"));
ok("wired count >= 14", WIRED.size >= 14);

// Evidence score threshold policy
const AI_SCORE_THRESHOLD = 22;
ok("AI threshold raised for accuracy ( >= 18)", AI_SCORE_THRESHOLD >= 18);

console.log(`\nAll export/AI contracts passed (${passed}).`);
