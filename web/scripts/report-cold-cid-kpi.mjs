/**
 * Live cold-CID densify KPI report.
 *
 * Usage:
 *   BASE_URL=https://chemrecipe--….hosted.app node scripts/report-cold-cid-kpi.mjs
 *   BASE_URL=http://localhost:3000 LIMIT=3 node scripts/report-cold-cid-kpi.mjs
 *   STRICT=1 BASE_URL=… node scripts/report-cold-cid-kpi.mjs   # exit 1 if any below floor
 *
 * Offline (no BASE_URL): prints golden set + floors only, exit 0.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GOLDEN = [
  { name: "Aspirin", cid: 2244 },
  { name: "Sitagliptin", cid: 4369359 },
  { name: "Penicillin G", cid: 5904 },
  { name: "Amoxicillin", cid: 33613 },
  { name: "Ibuprofen", cid: 3672 },
  { name: "Metformin", cid: 4091 },
  { name: "Baricitinib", cid: 44205240 },
  { name: "Filgotinib", cid: 49831257 },
  { name: "Larotrectinib", cid: 46188928 },
  { name: "Caffeine", cid: 2519 },
];

const FLOORS = {
  procedureChars: 800,
  processFacts: 2,
  idealParity: 35,
  evidenceScore: 28,
};

const BASE = (process.env.BASE_URL || process.env.APPHOSTING_URL || "").replace(
  /\/$/,
  ""
);
const LIMIT = Math.min(
  GOLDEN.length,
  Math.max(1, Number(process.env.LIMIT || GOLDEN.length) || GOLDEN.length)
);
const STRICT = process.env.STRICT === "1" || process.env.STRICT === "true";
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";
const OUT = process.env.OUT || "";

function evaluate(input) {
  const gaps = [];
  if ((input.procedureChars ?? 0) < FLOORS.procedureChars) {
    gaps.push(`proc ${input.procedureChars}<${FLOORS.procedureChars}`);
  }
  if ((input.processFacts ?? 0) < FLOORS.processFacts) {
    gaps.push(`facts ${input.processFacts}<${FLOORS.processFacts}`);
  }
  if ((input.idealParity ?? 0) < FLOORS.idealParity) {
    gaps.push(`ideal ${input.idealParity}<${FLOORS.idealParity}`);
  }
  if ((input.evidenceScore ?? 0) < FLOORS.evidenceScore) {
    gaps.push(`ev ${input.evidenceScore}<${FLOORS.evidenceScore}`);
  }
  return { meetsFloor: gaps.length === 0, gaps };
}

function metricsFromDossier(d) {
  if (!d) return null;
  const procChars =
    (d.procedureExcerpts || []).reduce(
      (n, p) => n + (p.chars || (p.text || "").length),
      0
    ) ||
    (d.literature || []).reduce(
      (n, h) => n + (h.fullTextExcerpt?.length || 0),
      0
    );
  const facts =
    d.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ?? 0;
  const ideal = d.idealParity?.score ?? d.idealParity ?? 0;
  const evidence = d.evidenceScore?.score ?? d.evidenceScore ?? 0;
  return {
    procedureChars: procChars,
    processFacts: facts,
    idealParity: typeof ideal === "number" ? ideal : 0,
    evidenceScore: typeof evidence === "number" ? evidence : 0,
    framing: d.processFraming,
    productMode: d.productMode,
    name: d.identity?.name,
  };
}

/** Consume SSE dossier stream; return final dossier event if present. */
async function densifyViaStream(cid) {
  const url = `${BASE}/api/dossier/${cid}/stream${FORCE ? "?force=1" : ""}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(240_000),
    headers: { accept: "text/event-stream" },
  });
  if (!res.ok) throw new Error(`stream HTTP ${res.status}`);
  const text = await res.text();
  let lastDossier = null;
  let lastError = null;
  for (const block of text.split("\n\n")) {
    const line = block
      .split("\n")
      .find((l) => l.startsWith("data: "));
    if (!line) continue;
    try {
      const ev = JSON.parse(line.slice(6));
      if (ev.type === "dossier" && ev.dossier) lastDossier = ev.dossier;
      if (ev.type === "complete" && ev.dossier) lastDossier = ev.dossier;
      if (ev.type === "error") lastError = ev.error || ev.message || "stream error";
      // Some pipelines emit dossier under result
      if (ev.dossier && (ev.type === "ready" || ev.type === "done")) {
        lastDossier = ev.dossier;
      }
    } catch {
      /* skip non-JSON heartbeats */
    }
  }
  if (lastDossier) return lastDossier;
  throw new Error(lastError || "stream ended without dossier");
}

async function densifyOne(cid, name) {
  const t0 = Date.now();
  // Prefer JSON batch (includeDossiers for full KPI); fall back to SSE stream
  const url = `${BASE}/api/dossier/batch`;
  let row = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cids: [cid],
        includeDossiers: true,
        force: FORCE,
        concurrency: 1,
        retries: 2,
      }),
      signal: AbortSignal.timeout(200_000),
    });
    if (!res.ok) {
      throw new Error(`batch HTTP ${res.status}`);
    }
    const data = await res.json();
    row =
      (data.results || []).find((r) => r.cid === cid) || data.results?.[0];
    if (!row?.ok) {
      throw new Error(row?.error || "batch fail");
    }
  } catch (batchErr) {
    process.stdout.write(`(batch: ${batchErr.message}; stream) `);
    const dossier = await densifyViaStream(cid);
    const m = metricsFromDossier(dossier);
    const floor = evaluate(m);
    return {
      cid,
      name: m.name || name,
      ...m,
      ...floor,
      durationMs: Date.now() - t0,
      ok: true,
      via: "stream",
    };
  }

  const m = metricsFromDossier(row.dossier);
  if (!m) {
    return {
      cid,
      name: row.summary?.name || name,
      procedureChars: row.summary?.procedureChars ?? 0,
      processFacts: 0,
      idealParity: row.summary?.idealScore ?? 0,
      evidenceScore: row.summary?.evidenceScore ?? 0,
      durationMs: Date.now() - t0,
      ok: true,
      via: "batch-summary",
      ...evaluate({
        procedureChars: row.summary?.procedureChars ?? 0,
        processFacts: 0,
        idealParity: row.summary?.idealScore ?? 0,
        evidenceScore: row.summary?.evidenceScore ?? 0,
      }),
    };
  }
  const floor = evaluate(m);
  return {
    cid,
    name: m.name || name,
    ...m,
    ...floor,
    durationMs: Date.now() - t0,
    ok: true,
    via: "batch",
  };
}

function formatMd(report) {
  const lines = [
    `# Cold-CID densify KPI report`,
    ``,
    `- Generated: ${report.generatedAt}`,
    report.baseUrl ? `- Base: ${report.baseUrl}` : null,
    `- Floor met: **${report.summary.metFloor}/${report.summary.total}** · errors ${report.summary.errors}`,
    `- Floors: proc≥${FLOORS.procedureChars} · facts≥${FLOORS.processFacts} · ideal≥${FLOORS.idealParity} · evidence≥${FLOORS.evidenceScore}`,
    ``,
    `| CID | Name | Floor | Proc | Facts | Ideal | Evidence | ms | Notes |`,
    `|-----|------|-------|------|-------|-------|----------|-----|-------|`,
  ].filter(Boolean);

  for (const r of report.rows) {
    const floor = !r.ok ? "error" : r.meetsFloor ? "ok" : "below";
    lines.push(
      `| ${r.cid} | ${r.name} | ${floor} | ${r.procedureChars ?? 0} | ${r.processFacts ?? 0} | ${r.idealParity ?? 0} | ${r.evidenceScore ?? 0} | ${r.durationMs ?? "—"} | ${(r.error || (r.gaps || []).join("; ") || "—").slice(0, 60)} |`
    );
  }
  lines.push(``);
  lines.push(`Not GMP. Free-public densify quality only.`);
  return lines.join("\n") + "\n";
}

console.log("report-cold-cid-kpi");
console.log(`golden ${GOLDEN.length} · limit ${LIMIT} · strict ${STRICT}`);

if (!BASE) {
  console.log("\nNo BASE_URL — golden floors only:");
  console.log(JSON.stringify({ floors: FLOORS, golden: GOLDEN.slice(0, LIMIT) }, null, 2));
  console.log("\nSet BASE_URL to densify live and score floors.");
  process.exit(0);
}

const targets = GOLDEN.slice(0, LIMIT);
const rows = [];
for (const g of targets) {
  process.stdout.write(`  densify ${g.name} (CID ${g.cid})… `);
  try {
    const r = await densifyOne(g.cid, g.name);
    rows.push(r);
    console.log(
      r.meetsFloor
        ? `ok floor · proc ${r.procedureChars} ideal ${r.idealParity}`
        : `below · ${r.gaps.join(", ")}`
    );
  } catch (e) {
    rows.push({
      cid: g.cid,
      name: g.name,
      procedureChars: 0,
      processFacts: 0,
      idealParity: 0,
      evidenceScore: 0,
      meetsFloor: false,
      gaps: [],
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    console.log("error", e instanceof Error ? e.message : e);
  }
}

const report = {
  schema: "chemistry-recipes.cold-cid-kpi.v1",
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  floors: FLOORS,
  summary: {
    total: rows.length,
    metFloor: rows.filter((r) => r.ok && r.meetsFloor).length,
    failedFloor: rows.filter((r) => r.ok && !r.meetsFloor).length,
    errors: rows.filter((r) => !r.ok).length,
  },
  rows,
};

const md = formatMd(report);
console.log("\n" + md);

if (OUT) {
  const path = OUT.endsWith(".json") || OUT.endsWith(".md")
    ? OUT
    : join(OUT, `cold-cid-kpi-${Date.now()}.md`);
  writeFileSync(path, path.endsWith(".json") ? JSON.stringify(report, null, 2) : md);
  console.log("wrote", path);
}

if (STRICT && (report.summary.failedFloor > 0 || report.summary.errors > 0)) {
  console.error(
    `STRICT fail · below ${report.summary.failedFloor} · errors ${report.summary.errors}`
  );
  process.exit(1);
}

console.log(
  `done · met ${report.summary.metFloor}/${report.summary.total}`
);
