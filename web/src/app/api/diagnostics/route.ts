import { NextResponse } from "next/server";
import { getServerAiEnv } from "@/lib/ai/serverEnv";
import { runPublicApiProbes, summarizeProbes } from "@/lib/diagnostics/probes";
import { curatedPackageCount } from "@/lib/data/curatedPackages";
import { getExampleCatalog } from "@/lib/data/examples";
import { CHEMISTRY_API_SOURCES } from "@/lib/sources/registry";
import {
  getFirebaseAdminCredentialsPath,
  getFirebaseProjectId,
  isFirebaseWebConfigured,
} from "@/lib/firebase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Diagnostics snapshot for operators.
 * Never returns secrets — only presence, lengths, and public probe results.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe") !== "0";

  const env = getServerAiEnv();
  const patentsKey = Boolean(
    (process.env.PATENTSVIEW_API_KEY || "").trim()
  );

  let probes = null;
  let probeSummary = null;
  if (probe) {
    probes = await runPublicApiProbes();
    probeSummary = summarizeProbes(probes);
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    app: {
      name: "Chemistry Recipes",
      nodeEnv: process.env.NODE_ENV || "development",
      curatedPackages: curatedPackageCount(),
      tierAExamples: getExampleCatalog().length,
      registrySources: CHEMISTRY_API_SOURCES.length,
    },
    env: {
      ollamaKeyConfigured: env.hasKey,
      ollamaCanCall: env.canCall,
      ollamaProvider: env.provider,
      ollamaKeySource: env.keySource,
      ollamaKeyLength: env.apiKey.length,
      ollamaModel: env.model,
      ollamaFastModel: env.fastModel,
      ollamaHost: env.host,
      patentsViewKeyConfigured: patentsKey,
      firebaseWebConfigured: isFirebaseWebConfigured(),
      firebaseProjectId: getFirebaseProjectId() || null,
      firebaseAdminCredsConfigured: Boolean(getFirebaseAdminCredentialsPath()),
    },
    firebase: {
      probeUrl: "/api/diagnostics/firebase",
      note: "GET /api/diagnostics/firebase for Admin Auth/Firestore health (no secrets).",
    },
    deploy: {
      probeUrl: "/api/diagnostics/deploy",
      cli: "npm run status:deploy",
      note: "Git tip + live App Hosting probe; full build/rollout via CLI with gcloud auth.",
    },
    probes,
    probeSummary,
    advice: buildAdvice({
      canCallOllama: env.canCall,
      isLocal: env.provider === "ollama-local",
      patentsKey,
      probeSummary,
    }),
  });
}

function buildAdvice(opts: {
  canCallOllama: boolean;
  isLocal: boolean;
  patentsKey: boolean;
  probeSummary: ReturnType<typeof summarizeProbes> | null;
}): string[] {
  const tips: string[] = [];
  if (!opts.canCallOllama) {
    tips.push(
      "Ollama dual-view synthesis is not ready (no Cloud key / local host). Free-public dossiers still work: evidence shell, process facts, densify harvest, and Tier-A teaching routes can look “AI-like” without Ollama."
    );
    tips.push(
      "To enable Ollama structure: set OLLAMA_CLOUD_API_KEY, or OLLAMA_HOST=http://127.0.0.1:11434 with ollama serve."
    );
  } else if (opts.isLocal) {
    tips.push(
      "Local Ollama host configured — ensure ollama serve is running and a model is pulled."
    );
  }
  if (!opts.patentsKey) {
    tips.push(
      "Optional PATENTSVIEW_API_KEY improves USPTO patent recall (PatentsView)."
    );
  }
  if (opts.probeSummary?.fail) {
    tips.push(
      `${opts.probeSummary.fail} free API probe(s) failed — check network, firewall, or upstream outages. Soft-fail gather still uses other sources; failed probes ≠ empty dossiers.`
    );
  }
  if (opts.probeSummary?.degraded) {
    tips.push(
      `${opts.probeSummary.degraded} API(s) slow (>2.5s) — dossier builds may feel sticky.`
    );
  }
  if (
    opts.canCallOllama &&
    opts.probeSummary &&
    opts.probeSummary.fail === 0 &&
    opts.probeSummary.ok > 0
  ) {
    tips.push(
      opts.isLocal
        ? "Core free APIs and local Ollama look ready for live dossier builds."
        : "Core free APIs and Ollama Cloud key look ready for live dossier builds."
    );
  }
  if (!tips.length) tips.push("No issues detected from this snapshot.");
  return tips;
}
