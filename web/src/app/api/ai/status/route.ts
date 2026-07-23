import { NextResponse } from "next/server";
import { debugServerAiEnvStatus, getServerAiEnv } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public status for the AI settings UI / badge.
 * Never returns the raw API key.
 */
export async function GET() {
  // Single resolve so keySource is consistent (file load may then mirror into process.env)
  const env = getServerAiEnv();
  return NextResponse.json({
    envKeyConfigured: env.hasKey,
    /** True when server can call Ollama (cloud key or local host) */
    canCall: env.canCall,
    provider: env.provider,
    envKeySource: env.hasKey
      ? env.keySource === "env-file"
        ? "OLLAMA_CLOUD_API_KEY (.env file)"
        : "OLLAMA_CLOUD_API_KEY (process.env)"
      : env.provider === "ollama-local"
        ? "local Ollama (no key)"
        : null,
    model: env.model,
    fastModel: env.fastModel,
    host: env.host,
    // Safe diagnostics only — never the secret
    keyLength: env.apiKey.length,
    keyResolveSource: env.keySource,
  });
}
