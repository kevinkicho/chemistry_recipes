/**
 * Playwright diagnosis of missing panels on the deployed site.
 *
 * Usage:
 *   node scripts/diagnose-deployed-panels.mjs
 *   BASE_URL=https://… node scripts/diagnose-deployed-panels.mjs
 *   node scripts/diagnose-deployed-panels.mjs --headed
 *
 * Exit 0 = all critical panels present; 2 = missing critical panels.
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE =
  process.env.BASE_URL ||
  "https://chemrecipe--chemistryrecipes.us-central1.hosted.app";
const headed = process.argv.includes("--headed");
const outDir = path.join(__dirname, "..", "diagnostics-output");

/** Expected section ids on live dossiers (from TableOfContents LIVE_SECTIONS). */
const LIVE_DOSSIER_PANELS = [
  { id: "identity", critical: true },
  { id: "structure", critical: true },
  { id: "overview", critical: true },
  { id: "process-framing", critical: false },
  { id: "critical-board", critical: false },
  { id: "process-parameters", critical: false },
  { id: "routes", critical: true },
  { id: "route-compare", critical: false },
  { id: "related-entities", critical: false },
  { id: "unit-op-fill", critical: false },
  { id: "industry-briefs", critical: false },
  { id: "multi-source", critical: false },
  { id: "contradictions", critical: false },
  { id: "pubchem-manufacturing", critical: false },
  { id: "literature", critical: false },
  { id: "patents", critical: false },
  { id: "manufacturing", critical: false },
  { id: "environment", critical: false },
  { id: "apparatus", critical: false },
  { id: "ehs", critical: false },
  { id: "hazards", critical: false },
  { id: "properties", critical: false },
  { id: "diagnostics", critical: false },
  { id: "build-audit", critical: false },
  { id: "sources", critical: false },
  { id: "disclaimer", critical: true },
];

const EXAMPLE_PANELS = [
  { id: "identity", critical: true },
  { id: "structure", critical: true },
  { id: "overview", critical: true },
  { id: "critical-board", critical: false },
  { id: "process-parameters", critical: false },
  { id: "routes", critical: true },
  { id: "route-compare", critical: false },
  { id: "related-entities", critical: false },
  { id: "manufacturing", critical: false },
  { id: "environment", critical: false },
  { id: "apparatus", critical: false },
  { id: "ehs", critical: false },
  { id: "hazards", critical: false },
  { id: "properties", critical: false },
  { id: "sources", critical: false },
  { id: "disclaimer", critical: true },
];

function url(p) {
  return `${BASE.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
}

async function waitForDossierReady(page, timeoutMs = 120_000) {
  // Client loader: ready or shell with content, or error
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const err = document.body.innerText.match(
        /failed|error loading|stream error|EventSource/i
      );
      const hasIdentity = !!document.getElementById("identity");
      const hasRoutes = !!document.getElementById("routes");
      const loading =
        /Harvest free public|Starting live dossier|checking cache|Loading/i.test(
          document.body.innerText
        ) && !hasIdentity;
      return {
        hasIdentity,
        hasRoutes,
        loading,
        errorText: err ? err[0] : null,
        bodySnippet: document.body.innerText.slice(0, 400),
      };
    });
    if (state.hasIdentity && state.hasRoutes) return { ok: true, ...state };
    if (state.errorText && !state.hasIdentity) {
      return { ok: false, ...state };
    }
    await page.waitForTimeout(1500);
  }
  const final = await page.evaluate(() => ({
    hasIdentity: !!document.getElementById("identity"),
    hasRoutes: !!document.getElementById("routes"),
    bodySnippet: document.body.innerText.slice(0, 600),
  }));
  return { ok: final.hasIdentity, timedOut: true, ...final };
}

async function expandCollapsibles(page) {
  // Open all collapsed sections so panel content is measurable
  await page.evaluate(() => {
    const buttons = [
      ...document.querySelectorAll("button, [role='button'], summary"),
    ];
    for (const b of buttons) {
      const t = (b.innerText || b.textContent || "").trim();
      // Common patterns: collapsed carets / "show" on section headers
      if (/▾|►|Show|Expand/i.test(t) || b.getAttribute("aria-expanded") === "false") {
        try {
          b.click();
        } catch {
          /* ignore */
        }
      }
    }
  });
  await page.waitForTimeout(800);
}

async function inventoryPanels(page, expected) {
  await expandCollapsibles(page);
  return page.evaluate((exp) => {
    const present = [];
    const missing = [];
    for (const p of exp) {
      const el = document.getElementById(p.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        const textLen = (el.innerText || "").trim().length;
        const img = el.querySelector("img");
        const imgOk =
          !!img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
        // structure is image-first — not empty if PNG loaded
        const empty =
          p.id === "structure" ? !imgOk : textLen < 20 && !imgOk;
        present.push({
          id: p.id,
          critical: p.critical,
          textLen,
          visible: rect.height > 0 && rect.width > 0,
          empty,
          imgOk: img ? imgOk : null,
          imgSrc: img?.src?.slice(0, 120) || null,
        });
      } else {
        missing.push({ id: p.id, critical: p.critical });
      }
    }
    const allIds = [...document.querySelectorAll("[id]")]
      .map((e) => e.id)
      .filter(Boolean);
    return { present, missing, allIds };
  }, expected);
}

async function diagnosePage(page, name, pagePath, opts = {}) {
  const full = url(pagePath);
  const result = {
    name,
    path: pagePath,
    url: full,
    ok: false,
    status: null,
    consoleErrors: [],
    pageErrors: [],
    panels: null,
    notes: [],
  };

  const onConsole = (msg) => {
    if (msg.type() === "error") {
      result.consoleErrors.push(msg.text().slice(0, 300));
    }
  };
  const onPageError = (err) => {
    result.pageErrors.push(String(err.message || err).slice(0, 300));
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    const resp = await page.goto(full, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    result.status = resp?.status() ?? null;

    if (opts.waitDossier) {
      const ready = await waitForDossierReady(page, opts.timeoutMs ?? 120_000);
      result.dossierReady = ready;
      if (!ready.ok) {
        result.notes.push(
          ready.timedOut
            ? "Timed out waiting for dossier identity+routes panels"
            : `Dossier not ready: ${ready.errorText || "unknown"}`
        );
      }
    } else if (opts.waitMs) {
      await page.waitForTimeout(opts.waitMs);
    } else {
      await page.waitForTimeout(2000);
    }

    if (opts.expectedPanels) {
      result.panels = await inventoryPanels(page, opts.expectedPanels);
      const critMissing = result.panels.missing.filter((m) => m.critical);
      const emptyCrit = result.panels.present.filter(
        (p) => p.critical && p.empty
      );
      const emptyOpt = result.panels.present.filter(
        (p) => !p.critical && p.empty
      );
      // Optional panels may be intentionally absent (e.g. contradictions)
      result.ok =
        critMissing.length === 0 &&
        emptyCrit.length === 0 &&
        (result.status === 200 || result.status === null);
      if (critMissing.length) {
        result.notes.push(
          `Missing critical: ${critMissing.map((m) => m.id).join(", ")}`
        );
      }
      if (emptyCrit.length) {
        result.notes.push(
          `Empty critical: ${emptyCrit.map((p) => p.id).join(", ")}`
        );
      }
      if (emptyOpt.length) {
        result.notes.push(
          `Thin/empty optional content: ${emptyOpt.map((p) => p.id).join(", ")}`
        );
      }
      const missOpt = result.panels.missing.filter((m) => !m.critical);
      if (missOpt.length) {
        result.notes.push(
          `Absent optional (may be conditional): ${missOpt.map((m) => m.id).join(", ")}`
        );
      }
    } else if (opts.checks) {
      const checks = await page.evaluate((c) => {
        const out = {};
        for (const [k, sel] of Object.entries(c)) {
          if (sel.startsWith("text:")) {
            out[k] = document.body.innerText.includes(sel.slice(5));
          } else if (sel.startsWith("id:")) {
            out[k] = !!document.getElementById(sel.slice(3));
          } else {
            out[k] = !!document.querySelector(sel);
          }
        }
        return out;
      }, opts.checks);
      result.checks = checks;
      result.ok = Object.values(checks).every(Boolean);
      const failed = Object.entries(checks)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (failed.length) result.notes.push(`Failed checks: ${failed.join(", ")}`);
    } else {
      result.ok = result.status === 200;
    }

    // Screenshot
    mkdirSync(outDir, { recursive: true });
    const shot = path.join(
      outDir,
      `${name.replace(/[^a-z0-9_-]+/gi, "_")}.png`
    );
    await page.screenshot({ path: shot, fullPage: true });
    result.screenshot = shot;

    // Visible headings sample
    result.headings = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,h3")]
        .slice(0, 25)
        .map((h) => `${h.tagName}: ${(h.innerText || "").trim().slice(0, 80)}`)
    );
  } catch (e) {
    result.ok = false;
    result.notes.push(e instanceof Error ? e.message : String(e));
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }

  return result;
}

async function main() {
  console.log(`Base: ${BASE}`);
  console.log(`Headed: ${headed}`);

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent:
      "ChemistryRecipes-Playwright-Diagnostics/1.0 (panel audit; educational)",
  });
  const page = await context.newPage();

  const results = [];

  // 1) Home — live nav + Info
  results.push(
    await diagnosePage(page, "home", "/", {
      waitMs: 2500,
      checks: {
        hasSearch: 'input[name="q"], form[action*="search"], input[type="search"], input[placeholder*="earch" i]',
        hasInfoLink: "text:Info",
        noCatalogTopNav: "text:!", // placeholder — fixed below
      },
    })
  );
  // Fix home checks properly
  {
    const r = results[results.length - 1];
    const home = await page.evaluate(() => {
      const nav = document.querySelector("header nav")?.innerText || "";
      return {
        navText: nav,
        hasInfo: /\bInfo\b/.test(nav),
        hasCatalogInNav: /\bCatalog\b/.test(nav),
        hasPackagesInNav: /\bPackages\b/.test(nav),
        hasSearchInNav: /\bSearch\b/.test(nav),
        h1: document.querySelector("h1")?.innerText?.slice(0, 100) || "",
      };
    });
    r.homeNav = home;
    r.ok = home.hasInfo && home.hasSearchInNav && !home.hasCatalogInNav;
    r.notes = [];
    if (!home.hasInfo) r.notes.push("Header missing Info");
    if (home.hasCatalogInNav) r.notes.push("Catalog still in top nav (should be Info-only)");
    if (home.hasPackagesInNav) r.notes.push("Packages still in top nav (should be Info-only)");
  }

  // 2) Search — progressive results
  results.push(
    await diagnosePage(page, "search-aspirin", "/search?q=aspirin", {
      waitMs: 8000,
      checks: {
        resultsSection: "id:pubchem-results",
        aspirinCard: "text:Aspirin",
        cidLink: 'a[href*="/compounds/pubchem/2244"]',
      },
    })
  );

  // 3) Live dossier CID 2244 — main panel audit
  results.push(
    await diagnosePage(page, "live-cid-2244", "/compounds/pubchem/2244", {
      waitDossier: true,
      timeoutMs: 150_000,
      expectedPanels: LIVE_DOSSIER_PANELS,
    })
  );

  // 4) Example (for-show) aspirin
  results.push(
    await diagnosePage(page, "example-aspirin", "/examples/aspirin", {
      waitMs: 3000,
      expectedPanels: EXAMPLE_PANELS,
    })
  );

  // 5) Info hub
  results.push(
    await diagnosePage(page, "info", "/info", {
      waitMs: 2500,
      checks: {
        forShow: "text:For show",
        curated: "text:Curated",
        packages: "text:package",
      },
    })
  );

  await browser.close();

  // Report
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    results,
    summary: {
      pages: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map((r) => r.name),
    },
  };

  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "panel-report.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log("\n=== Panel diagnosis report ===\n");
  for (const r of results) {
    const mark = r.ok ? "OK " : "FAIL";
    console.log(`[${mark}] ${r.name}  ${r.url}  HTTP ${r.status}`);
    if (r.notes?.length) {
      for (const n of r.notes) console.log(`       · ${n}`);
    }
    if (r.panels) {
      const missC = r.panels.missing.filter((m) => m.critical).map((m) => m.id);
      const missO = r.panels.missing.filter((m) => !m.critical).map((m) => m.id);
      const empty = r.panels.present.filter((p) => p.empty).map((p) => p.id);
      console.log(
        `       present ${r.panels.present.length}/${r.panels.present.length + r.panels.missing.length}`
      );
      if (missC.length) console.log(`       MISSING critical: ${missC.join(", ")}`);
      if (missO.length) console.log(`       missing optional: ${missO.join(", ")}`);
      if (empty.length) console.log(`       empty/low-text: ${empty.join(", ")}`);
    }
    if (r.checks) {
      console.log(`       checks: ${JSON.stringify(r.checks)}`);
    }
    if (r.consoleErrors?.length) {
      console.log(`       console errors: ${r.consoleErrors.length}`);
      r.consoleErrors.slice(0, 3).forEach((e) => console.log(`         ${e}`));
    }
    if (r.screenshot) console.log(`       shot: ${r.screenshot}`);
    console.log("");
  }

  console.log(
    `Summary: ${report.summary.ok}/${report.summary.pages} pages OK. Failed: ${report.summary.failed.join(", ") || "none"}`
  );
  console.log(`JSON: ${jsonPath}`);

  process.exit(report.summary.failed.length ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
