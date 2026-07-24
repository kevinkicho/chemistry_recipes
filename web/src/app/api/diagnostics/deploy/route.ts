/**
 * Deploy / App Hosting health snapshot for troubleshooting.
 * Probes the live hosted URL; optionally includes GitHub commit of main via public API.
 * Never returns secrets.
 */

import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "chemistryrecipes";
const BACKEND = process.env.APPHOSTING_BACKEND || "chemrecipe";
const LOCATION = process.env.APPHOSTING_LOCATION || "us-central1";
const LIVE =
  process.env.APPHOSTING_URL ||
  `https://${BACKEND}--${PROJECT}.${LOCATION}.hosted.app`;
const GITHUB = process.env.GITHUB_REPOSITORY || "kevinkicho/chemistry_recipes";

function readExpectedRootDir(): string | null {
  try {
    // From web/ cwd → repo root firebase.json
    const candidates = [
      path.resolve(process.cwd(), "firebase.json"),
      path.resolve(process.cwd(), "..", "firebase.json"),
    ];
    for (const p of candidates) {
      if (!existsSync(p)) continue;
      const j = JSON.parse(readFileSync(p, "utf8")) as {
        apphosting?: { rootDir?: string; backendId?: string };
      };
      return j.apphosting?.rootDir ?? null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET() {
  const expectedRootDir = readExpectedRootDir();
  const issues: string[] = [];
  const warnings: string[] = [];

  let live: {
    ok: boolean;
    status: number | null;
    ms: number;
    error?: string;
  } = { ok: false, status: null, ms: 0 };

  const t0 = Date.now();
  try {
    const res = await fetch(LIVE, {
      redirect: "follow",
      headers: { Accept: "text/html" },
      cache: "no-store",
    });
    live = { ok: res.ok, status: res.status, ms: Date.now() - t0 };
    if (!res.ok) {
      issues.push(`Live host HTTP ${res.status} (${LIVE})`);
    }
  } catch (e) {
    live = {
      ok: false,
      status: null,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : "fetch failed",
    };
    issues.push(`Live host unreachable: ${live.error}`);
  }

  let githubMain: {
    sha: string | null;
    message: string | null;
    date: string | null;
  } | null = null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB}/commits/main`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "chemistry-recipes-diagnostics",
        },
        next: { revalidate: 60 },
      }
    );
    if (res.ok) {
      const j = (await res.json()) as {
        sha?: string;
        commit?: { message?: string; author?: { date?: string } };
      };
      githubMain = {
        sha: j.sha?.slice(0, 7) ?? null,
        message: j.commit?.message?.split("\n")[0] ?? null,
        date: j.commit?.author?.date ?? null,
      };
    } else {
      warnings.push(`GitHub main commit HTTP ${res.status}`);
    }
  } catch {
    warnings.push("GitHub API unreachable for main tip");
  }

  if (expectedRootDir && expectedRootDir !== "web") {
    warnings.push(`firebase.json rootDir is "${expectedRootDir}" (expected web for this monorepo)`);
  }
  if (!expectedRootDir) {
    warnings.push("Could not read firebase.json apphosting.rootDir from disk");
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    git: {
      githubRepo: GITHUB,
      main: githubMain,
      note: "Local dirty/ahead state: run `npm run status:deploy` on a workstation with git + gcloud.",
    },
    apphosting: {
      project: PROJECT,
      backendId: BACKEND,
      location: LOCATION,
      liveUrl: LIVE,
      live,
      expectedRootDir,
      consoleUrl: `https://console.firebase.google.com/project/${PROJECT}/apphosting`,
      fullStatusCli: "npm run status:deploy  # repo root or web/",
    },
    issues,
    warnings,
    ok: issues.length === 0,
  });
}
