/**
 * Server-only Ollama Cloud credentials from environment (.env).
 * Used for development and as fallback when the browser does not send a key.
 *
 * Supported env vars (first match wins for key):
 * - OLLAMA_CLOUD_API_KEY  (this repo)
 * - OLLAMA_API_KEY          (Ollama docs name)
 *
 * Optional:
 * - OLLAMA_CLOUD_MODEL / OLLAMA_MODEL
 * - OLLAMA_CLOUD_HOST / OLLAMA_HOST
 *
 * Monorepo note: Next.js only auto-loads web/.env*. The repo-root
 * `.env` is loaded here at runtime so OLLAMA_CLOUD_API_KEY works
 * without copying secrets into web/.
 */

import fs from "fs";
import path from "path";
import {
  DEFAULT_OLLAMA_CLOUD_FAST_MODEL,
  DEFAULT_OLLAMA_CLOUD_MODEL,
  DEFAULT_OLLAMA_LOCAL_MODEL,
  isLocalOllamaHost,
  OLLAMA_CLOUD_HOST,
  type AiProvider,
} from "@/lib/ai/config";

export interface ServerAiEnv {
  apiKey: string;
  model: string;
  /** Faster model for thin-evidence draft synthesis */
  fastModel: string;
  host: string;
  /** True when a non-empty key is present */
  hasKey: boolean;
  /** Cloud key present OR local host (can call without Bearer) */
  canCall: boolean;
  provider: AiProvider;
  /** Where the key was resolved from (never includes the secret) */
  keySource: "process" | "env-file" | null;
  envFilePath?: string;
}

let fileEnvCache: Record<string, string> | null = null;

/** Parse KEY=VALUE lines (simple .env, no export/multiline). */
function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip matching quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Candidate directories for .env:
 * - process.cwd() (usually web/ when running next dev)
 * - parent of cwd (monorepo root)
 * - parent of this package (web → root) via cwd heuristics
 */
function envSearchDirs(): string[] {
  const cwd = process.cwd();
  const dirs = new Set<string>([
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "../.."),
  ]);
  // If cwd is monorepo root, also check web/
  dirs.add(path.resolve(cwd, "web"));
  return [...dirs];
}

function loadFileEnv(): Record<string, string> {
  if (fileEnvCache) return fileEnvCache;

  const merged: Record<string, string> = {};
  const names = [".env.local", ".env"];

  for (const dir of envSearchDirs()) {
    for (const name of names) {
      const full = path.join(dir, name);
      try {
        if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
        const parsed = parseEnvFile(fs.readFileSync(full, "utf8"));
        // First write wins for each key (prefer .env.local / earlier dirs)
        for (const [k, v] of Object.entries(parsed)) {
          if (!(k in merged) && v) merged[k] = v;
        }
      } catch {
        /* ignore unreadable files */
      }
    }
  }

  fileEnvCache = merged;
  return merged;
}

/**
 * Read env var without relying solely on Next static inlining of process.env.X.
 * Bracket access + file fallback so monorepo-root .env works.
 */
function readVar(name: string): { value: string; source: "process" | "env-file" | null; fileHint?: string } {
  // Bracket notation avoids some bundlers replacing with empty string at build time
  const fromProcess = (process.env[name] || "").trim();
  if (fromProcess) return { value: fromProcess, source: "process" };

  const fileEnv = loadFileEnv();
  const fromFile = (fileEnv[name] || "").trim();
  if (fromFile) {
    // Mirror into process.env for any other code that reads it
    process.env[name] = fromFile;
    return { value: fromFile, source: "env-file" };
  }

  return { value: "", source: null };
}

export function getServerAiEnv(): ServerAiEnv {
  const keyPrimary = readVar("OLLAMA_CLOUD_API_KEY");
  const keyAlt = keyPrimary.value ? keyPrimary : readVar("OLLAMA_API_KEY");
  const apiKey = keyAlt.value;

  const host = (
    readVar("OLLAMA_CLOUD_HOST").value ||
    readVar("OLLAMA_HOST").value ||
    OLLAMA_CLOUD_HOST
  ).replace(/\/$/, "");
  const hostFinal = host || OLLAMA_CLOUD_HOST;
  const local = isLocalOllamaHost(hostFinal);
  const provider: AiProvider = local ? "ollama-local" : "ollama-cloud";

  const model =
    readVar("OLLAMA_CLOUD_MODEL").value ||
    readVar("OLLAMA_MODEL").value ||
    (local ? DEFAULT_OLLAMA_LOCAL_MODEL : DEFAULT_OLLAMA_CLOUD_MODEL);

  const fastModel =
    readVar("OLLAMA_CLOUD_FAST_MODEL").value ||
    DEFAULT_OLLAMA_CLOUD_FAST_MODEL ||
    model;

  const hasKey = Boolean(apiKey);

  return {
    apiKey,
    model: model || (local ? DEFAULT_OLLAMA_LOCAL_MODEL : DEFAULT_OLLAMA_CLOUD_MODEL),
    fastModel: fastModel || model || DEFAULT_OLLAMA_CLOUD_MODEL,
    host: hostFinal,
    hasKey,
    canCall: hasKey || local,
    provider,
    keySource: apiKey ? keyAlt.source : null,
  };
}

/** Prefer request Bearer key; fall back to .env for development. */
export function resolveRequestApiKey(authorizationHeader: string | null): {
  apiKey: string | null;
  source: "request" | "env" | null;
} {
  const match = (authorizationHeader || "").match(/^Bearer\s+(.+)$/i);
  const fromRequest = match?.[1]?.trim();
  if (fromRequest) return { apiKey: fromRequest, source: "request" };

  const env = getServerAiEnv();
  if (env.hasKey) return { apiKey: env.apiKey, source: "env" };

  return { apiKey: null, source: null };
}

/** Test helper / diagnostics — never log the key itself. */
export function debugServerAiEnvStatus(): {
  hasKey: boolean;
  keySource: ServerAiEnv["keySource"];
  keyLength: number;
  model: string;
  host: string;
  searchDirs: string[];
} {
  const env = getServerAiEnv();
  return {
    hasKey: env.hasKey,
    keySource: env.keySource,
    keyLength: env.apiKey.length,
    model: env.model,
    host: env.host,
    searchDirs: envSearchDirs(),
  };
}
