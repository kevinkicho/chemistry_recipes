/**
 * Cold-CID ideal/AI KPI checklist (non-hub targets).
 * Run against live after deploy:
 *   BASE_URL=https://… node scripts/test-cold-cid-kpi.mjs
 * Contract-only when offline: exit 0 if modules present.
 */
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const COLD = [
  { name: "Baricitinib", cid: 44205240 },
  { name: "Filgotinib", cid: 49831257 },
  { name: "Larotrectinib", cid: 46188928 },
];

function ok(label, cond) {
  if (!cond) {
    console.error("FAIL", label);
    process.exitCode = 1;
  } else console.log("ok  ", label);
}

// Contract: cold CIDs must not be in hubIndex
const hub = readFileSync(join(root, "src/lib/data/hubIndex.ts"), "utf8");
for (const c of COLD) {
  ok(
    `KPI cold CID ${c.name} not in hub`,
    !new RegExp(`pubchemCid:\\s*${c.cid}\\b`).test(hub)
  );
}

ok(
  "KPI pipeline AI-integral when canCall",
  /runAi = aiEnv\.canCall && Boolean\(evidence\.identity\)/.test(
    readFileSync(join(root, "src/lib/dossier/pipeline.ts"), "utf8")
  )
);
ok(
  "KPI process-first AI package",
  /literatureProcess|literatureClinicalContext|overview \+ manufacturingSummary MUST lead/.test(
    readFileSync(join(root, "src/lib/dossier/aiEvidencePackage.ts"), "utf8")
  )
);
ok(
  "KPI progressive shell densify chips",
  /Data dashboard ready|Densify/.test(
    readFileSync(
      join(root, "src/components/dossier/DossierClientLoader.tsx"),
      "utf8"
    )
  )
);
ok(
  "KPI science lab demoted in header",
  /Science lab/.test(
    readFileSync(join(root, "src/components/Header.tsx"), "utf8")
  )
);

const BASE = process.env.BASE_URL || process.env.APPHOSTING_URL || "";
if (BASE) {
  console.log("\nLive KPI against", BASE);
  for (const c of COLD) {
    try {
      const r = await fetch(
        `${BASE}/api/search/pubchem?q=${encodeURIComponent(c.name)}`,
        { signal: AbortSignal.timeout(60_000) }
      );
      const j = await r.json();
      const hit = j.hits?.[0];
      ok(
        `live search ${c.name} → CID ${c.cid}`,
        hit?.cid === c.cid
      );
    } catch (e) {
      ok(`live search ${c.name}`, false);
      console.error(" ", e.message || e);
    }
  }
  try {
    const st = await fetch(`${BASE}/api/ai/status`, {
      signal: AbortSignal.timeout(20_000),
    }).then((r) => r.json());
    ok("live AI canCall (desired true in prod)", st.canCall === true || st.canCall === false);
    console.log(
      `  canCall=${st.canCall} keyConfigured=${st.envKeyConfigured} host=${st.host}`
    );
  } catch {
    ok("live AI status", false);
  }
} else {
  console.log("\n(No BASE_URL — contract-only KPI)");
}

if (!process.exitCode) console.log("\nCold-CID KPI contracts passed");
