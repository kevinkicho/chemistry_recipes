/**
 * Deploy status: git push alignment + Firebase App Hosting health.
 *
 * Usage (repo root or web/):
 *   node web/scripts/status-deploy.mjs
 *   node web/scripts/status-deploy.mjs --json
 *
 * Optional env:
 *   FIREBASE_PROJECT_ID=chemistryrecipes
 *   APPHOSTING_BACKEND=chemrecipe
 *   APPHOSTING_LOCATION=us-central1
 *   GITHUB_REPOSITORY=kevinkicho/chemistry_recipes
 *
 * Auth for App Hosting REST:
 *   gcloud auth application-default login
 *   or GOOGLE_APPLICATION_CREDENTIALS / gcloud access token via `gcloud auth print-access-token`
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");
const asJson = process.argv.includes("--json");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "chemistryrecipes";
const BACKEND = process.env.APPHOSTING_BACKEND || "chemrecipe";
const LOCATION = process.env.APPHOSTING_LOCATION || "us-central1";
const GITHUB_REPO =
  process.env.GITHUB_REPOSITORY || "kevinkicho/chemistry_recipes";
const LIVE_HOST =
  process.env.APPHOSTING_URL ||
  `https://${BACKEND}--${PROJECT}.${LOCATION}.hosted.app`;

function sh(cmd, cwd = repoRoot) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    return null;
  }
}

function getAccessToken() {
  if (process.env.CLOUD_SDK_ACCESS_TOKEN) {
    return process.env.CLOUD_SDK_ACCESS_TOKEN;
  }
  const r = spawnSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (r.status === 0 && r.stdout?.trim()) return r.stdout.trim();
  return null;
}

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, data };
}

function readFirebaseJson() {
  const p = path.join(repoRoot, "firebase.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const issues = [];
  const warnings = [];

  // --- Git ---
  const branch = sh("git rev-parse --abbrev-ref HEAD") || "unknown";
  const head = sh("git rev-parse HEAD") || null;
  const short = head ? head.slice(0, 7) : null;
  const remote = sh("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
  sh("git fetch origin --quiet");
  const originHead = sh("git rev-parse origin/main") || sh("git rev-parse origin/master");
  const ahead =
    head && originHead
      ? Number(sh(`git rev-list --count origin/main..HEAD`) || "0")
      : null;
  const behind =
    head && originHead
      ? Number(sh(`git rev-list --count HEAD..origin/main`) || "0")
      : null;
  const dirty = Boolean(sh("git status --porcelain"));
  const untrackedFirebase =
    sh("git status --porcelain firebase.json .firebaserc web/apphosting.yaml") ||
    "";

  if (!remote) {
    issues.push("No upstream tracking branch set for HEAD.");
  }
  if (ahead && ahead > 0) {
    issues.push(`${ahead} local commit(s) not pushed to origin/main.`);
  }
  if (behind && behind > 0) {
    warnings.push(`${behind} commit(s) on origin/main not pulled.`);
  }
  if (dirty) {
    warnings.push("Working tree has uncommitted changes (not on App Hosting).");
  }
  if (untrackedFirebase.includes("firebase.json") || untrackedFirebase.includes("??")) {
    warnings.push(
      "Firebase / App Hosting config may be untracked — push will not include it until committed."
    );
  }

  // --- Expected local config ---
  const fj = readFirebaseJson();
  const expectedRoot =
    fj?.apphosting?.rootDir || fj?.apphosting?.rootDirectory || null;
  const backendId = fj?.apphosting?.backendId || BACKEND;

  // --- Live probe ---
  let live = { ok: false, status: null, error: null };
  try {
    const res = await fetch(LIVE_HOST, { redirect: "follow" });
    live = {
      ok: res.ok,
      status: res.status,
      url: LIVE_HOST,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
    if (!res.ok) {
      issues.push(`Live App Hosting URL returned HTTP ${res.status}: ${LIVE_HOST}`);
    }
  } catch (e) {
    live = {
      ok: false,
      status: null,
      url: LIVE_HOST,
      error: e instanceof Error ? e.message : String(e),
    };
    issues.push(`Live URL unreachable: ${live.error}`);
  }

  // --- App Hosting API ---
  const token = getAccessToken();
  let backend = null;
  let builds = [];
  let rollouts = [];
  let apiError = null;

  if (!token) {
    warnings.push(
      "No gcloud access token — skipped App Hosting API (run: gcloud auth login)."
    );
  } else {
    const base = `https://firebaseapphosting.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/backends/${backendId}`;
    const b = await fetchJson(base, token);
    if (!b.ok) {
      apiError = `Backend GET HTTP ${b.status}`;
      issues.push(apiError);
    } else {
      backend = b.data;
      const rootDir = backend?.codebase?.rootDirectory ?? "/";
      if (expectedRoot && rootDir.replace(/^\//, "") !== String(expectedRoot).replace(/^\//, "")) {
        issues.push(
          `App Hosting rootDirectory is "${rootDir}" but firebase.json rootDir is "${expectedRoot}". Builds may fail (next not found).`
        );
      }
      if (rootDir === "/" || rootDir === "") {
        issues.push(
          'App Hosting codebase.rootDirectory is "/" — monorepo Next app lives under web/.'
        );
      }
    }

    const bl = await fetchJson(`${base}/builds`, token);
    if (bl.ok) {
      builds = (bl.data.builds || []).slice().sort((a, b) =>
        String(b.createTime || "").localeCompare(String(a.createTime || ""))
      );
    }
    const rl = await fetchJson(`${base}/rollouts`, token);
    if (rl.ok) {
      rollouts = (rl.data.rollouts || []).slice().sort((a, b) =>
        String(b.createTime || "").localeCompare(String(a.createTime || ""))
      );
    }

    // Prefer meaningful "latest": READY builds / SUCCEEDED rollouts over stuck QUEUED spam
    const buildRank = (s) => {
      const u = String(s || "").toUpperCase();
      if (u === "READY" || u === "SUCCEEDED") return 0;
      if (u === "BUILDING" || u === "CREATING" || u === "PROGRESSING") return 1;
      if (u === "PENDING" || u === "QUEUED") return 2;
      if (u === "FAILED" || u === "ERROR" || u === "CANCELLED") return 3;
      return 4;
    };
    const rolloutRank = (s) => {
      const u = String(s || "").toUpperCase();
      if (u === "SUCCEEDED" || u === "ACTIVE") return 0;
      if (u === "PROGRESSING" || u === "BUILDING") return 1;
      if (u === "PENDING" || u === "QUEUED") return 2;
      if (u === "FAILED" || u === "ERROR" || u === "CANCELLED") return 3;
      return 4;
    };
    const byTime = (a, b) =>
      String(b.createTime || "").localeCompare(String(a.createTime || ""));

    const preferredBuild =
      [...builds].sort(
        (a, b) => buildRank(a.state) - buildRank(b.state) || byTime(a, b)
      )[0] || builds[0];
    const preferredRollout =
      [...rollouts].sort(
        (a, b) =>
          rolloutRank(a.state) - rolloutRank(b.state) || byTime(a, b)
      )[0] || rollouts[0];
    // Keep raw time-sorted lists; use preferred for display fields below
    const latestBuild = preferredBuild;
    const latestRollout = preferredRollout;
    const newestByTime = rollouts[0];
    if (
      newestByTime &&
      latestRollout &&
      newestByTime.name !== latestRollout.name &&
      /QUEUED|PENDING/i.test(newestByTime.state || "") &&
      /SUCCEEDED|ACTIVE/i.test(latestRollout.state || "")
    ) {
      warnings.push(
        `Newest rollout is ${newestByTime.name?.split("/").pop()} (${newestByTime.state}); reporting preferred SUCCEEDED ${latestRollout.name?.split("/").pop()} instead.`
      );
    }

    const buildOk = new Set(["READY", "SUCCEEDED", "BUILDING", "CREATING", "PENDING"]);
    if (latestBuild?.state === "FAILED") {
      issues.push(
        `Latest build FAILED: ${latestBuild.name?.split("/").pop()} (commit ${latestBuild.source?.codebase?.hash?.slice(0, 7) || "?"}). Logs: ${latestBuild.buildLogsUri || "n/a"}`
      );
    } else if (latestBuild?.state && !buildOk.has(latestBuild.state)) {
      warnings.push(`Latest build state: ${latestBuild.state}`);
    }
    if (latestRollout?.state === "FAILED") {
      issues.push(`Latest rollout FAILED: ${latestRollout.name?.split("/").pop()}`);
    } else if (
      latestRollout?.state &&
      !["SUCCEEDED", "ACTIVE", "PENDING", "PROGRESSING", "QUEUED", "BUILDING"].includes(
        latestRollout.state
      )
    ) {
      warnings.push(`Latest rollout state: ${latestRollout.state}`);
    }
    // Align "deployed" commit with preferred SUCCEEDED rollout's build when possible
    let deployedHash = latestBuild?.source?.codebase?.hash;
    if (latestRollout?.build && builds.length) {
      const rolled = builds.find((b) => b.name === latestRollout.build);
      if (rolled?.source?.codebase?.hash) {
        deployedHash = rolled.source.codebase.hash;
      }
    }
    if (deployedHash && head) {
      if (deployedHash !== head && ahead === 0 && !dirty) {
        warnings.push(
          `Deployed commit ${deployedHash.slice(0, 7)} differs from local HEAD ${short} (may be older successful/failed build).`
        );
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    git: {
      branch,
      head: short,
      headFull: head,
      upstream: remote,
      originMain: originHead ? originHead.slice(0, 7) : null,
      aheadOfOriginMain: ahead,
      behindOriginMain: behind,
      dirty,
      github: `https://github.com/${GITHUB_REPO}/commit/${head || ""}`,
      pushedAligned: ahead === 0 && behind === 0,
    },
    apphosting: {
      project: PROJECT,
      backendId,
      location: LOCATION,
      liveUrl: LIVE_HOST,
      live,
      expectedRootDir: expectedRoot,
      remoteRootDirectory: backend?.codebase?.rootDirectory ?? null,
      uri: backend?.uri ?? null,
      serviceAccount: backend?.serviceAccount ?? null,
      latestBuild: (() => {
        // Prefer READY over time-sorted QUEUED/FAILED noise
        const buildRank = (s) => {
          const u = String(s || "").toUpperCase();
          if (u === "READY" || u === "SUCCEEDED") return 0;
          if (u === "BUILDING" || u === "CREATING" || u === "PROGRESSING") return 1;
          if (u === "PENDING" || u === "QUEUED") return 2;
          return 3;
        };
        const b =
          [...builds].sort(
            (a, c) =>
              buildRank(a.state) - buildRank(c.state) ||
              String(c.createTime || "").localeCompare(String(a.createTime || ""))
          )[0] || builds[0];
        return b
          ? {
              id: b.name?.split("/").pop(),
              state: b.state,
              commit: b.source?.codebase?.hash?.slice(0, 7),
              commitFull: b.source?.codebase?.hash,
              message: b.source?.codebase?.commitMessage?.split("\n")[0],
              logs: b.buildLogsUri,
              createTime: b.createTime,
              errors: b.errors,
            }
          : null;
      })(),
      latestRollout: (() => {
        const rolloutRank = (s) => {
          const u = String(s || "").toUpperCase();
          if (u === "SUCCEEDED" || u === "ACTIVE") return 0;
          if (u === "PROGRESSING" || u === "BUILDING") return 1;
          if (u === "PENDING" || u === "QUEUED") return 2;
          return 3;
        };
        const r =
          [...rollouts].sort(
            (a, c) =>
              rolloutRank(a.state) - rolloutRank(c.state) ||
              String(c.createTime || "").localeCompare(String(a.createTime || ""))
          )[0] || rollouts[0];
        return r
          ? {
              id: r.name?.split("/").pop(),
              state: r.state,
              createTime: r.createTime,
              buildId: r.build?.split("/").pop(),
            }
          : null;
      })(),
      buildCount: builds.length,
      rolloutCount: rollouts.length,
      apiError,
    },
    issues,
    warnings,
    ok: issues.length === 0,
    fixHints: [
      'Set App Hosting root directory to "web" (Console → App Hosting → Backend settings, or PATCH codebase.rootDirectory).',
      "Commit & push firebase.json, web/apphosting.yaml, and app code so GitHub-connected builds see them.",
      `Trigger rollout: npx firebase-tools@latest apphosting:rollouts:create ${backendId} -b main -f --project ${PROJECT}`,
      `Build logs (last fail): see apphosting.latestBuild.logs`,
      `Probe: curl -I ${LIVE_HOST}`,
    ],
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Deploy status ===");
    console.log(`Generated: ${report.generatedAt}`);
    console.log("");
    console.log("Git");
    console.log(
      `  branch ${branch}  HEAD ${short}  origin/main ${report.git.originMain}  ahead ${ahead} behind ${behind}  dirty ${dirty}`
    );
    console.log(`  aligned with origin/main: ${report.git.pushedAligned}`);
    console.log("");
    console.log("App Hosting");
    console.log(`  backend ${backendId}  live ${LIVE_HOST}`);
    console.log(
      `  live HTTP: ${live.status ?? "n/a"} ${live.ok ? "OK" : live.error || ""}`
    );
    console.log(
      `  rootDir expected=${expectedRoot} remote=${report.apphosting.remoteRootDirectory}`
    );
    if (report.apphosting.latestBuild) {
      const b = report.apphosting.latestBuild;
      console.log(
        `  latest build: ${b.id}  ${b.state}  commit ${b.commit}  ${b.message || ""}`
      );
      if (b.logs) console.log(`  logs: ${b.logs}`);
    }
    if (report.apphosting.latestRollout) {
      const r = report.apphosting.latestRollout;
      console.log(`  latest rollout: ${r.id}  ${r.state}`);
    }
    console.log("");
    if (issues.length) {
      console.log("ISSUES");
      for (const i of issues) console.log(`  ✗ ${i}`);
    }
    if (warnings.length) {
      console.log("WARNINGS");
      for (const w of warnings) console.log(`  ! ${w}`);
    }
    if (!issues.length && !warnings.length) {
      console.log("No issues detected.");
    }
    console.log("");
    console.log("Fix hints:");
    for (const h of report.fixHints) console.log(`  · ${h}`);
  }

  process.exit(report.ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
