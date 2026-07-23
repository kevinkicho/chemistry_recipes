/**
 * User AI configuration for Ollama Cloud.
 * Docs: https://docs.ollama.com/cloud
 *
 * API key is stored only in the browser (localStorage). It is never written to
 * the server filesystem. When calling the app API, the key is sent per-request
 * so the Next.js route can proxy to ollama.com (avoids browser CORS issues).
 */

export const OLLAMA_CLOUD_HOST = "https://ollama.com";
/** Default local Ollama native host (air-gapped / plant laptop option) */
export const OLLAMA_LOCAL_HOST = "http://127.0.0.1:11434";
export const OLLAMA_CLOUD_CHAT_PATH = "/api/chat";
export const OLLAMA_CLOUD_TAGS_PATH = "/api/tags";

/** Default cloud model (user can override). See ollama.com model library. */
export const DEFAULT_OLLAMA_CLOUD_MODEL = "gpt-oss:120b";
/** Sensible default when running local Ollama (user should pull a model first) */
export const DEFAULT_OLLAMA_LOCAL_MODEL = "llama3.1";

/**
 * Faster draft model for thin evidence (override with OLLAMA_CLOUD_FAST_MODEL).
 * Falls back to primary model if unset or identical.
 */
export const DEFAULT_OLLAMA_CLOUD_FAST_MODEL = "gpt-oss:120b";

const STORAGE_KEY = "cr-ai-config-v1";

export type AiProvider = "ollama-cloud" | "ollama-local";

export interface AiConfig {
  /** Master switch — when false, AI features stay off */
  enabled: boolean;
  /** ollama-cloud (default) or ollama-local for air-gapped plants */
  provider: AiProvider;
  /** Ollama Cloud API key from https://ollama.com/settings/keys (unused for local) */
  apiKey: string;
  /** Primary model name, e.g. gpt-oss:120b or llama3.1 */
  model: string;
  /** Optional faster model for thin-evidence synthesis */
  fastModel: string;
  /** Remote host (cloud or local Ollama) */
  host: string;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  provider: "ollama-cloud",
  apiKey: "",
  model: DEFAULT_OLLAMA_CLOUD_MODEL,
  fastModel: DEFAULT_OLLAMA_CLOUD_FAST_MODEL,
  host: OLLAMA_CLOUD_HOST,
};

/** True when host is a loopback / private LAN Ollama (no cloud key required). */
export function isLocalOllamaHost(host: string): boolean {
  try {
    const u = new URL(host.replace(/\/$/, ""));
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") {
      return u.protocol === "http:" || u.protocol === "https:";
    }
    // RFC1918 private ranges (optional plant-LAN Ollama)
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return u.protocol === "http:" || u.protocol === "https:";
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return u.protocol === "http:" || u.protocol === "https:";
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) {
      return u.protocol === "http:" || u.protocol === "https:";
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * SSRF-safe allowlist for AI proxy hosts.
 * Cloud: https://ollama.com only.
 * Local: loopback + private LAN http(s).
 */
export function isAllowedOllamaHost(host: string): boolean {
  try {
    const u = new URL(host.replace(/\/$/, ""));
    if (u.hostname.toLowerCase() === "ollama.com") {
      return u.protocol === "https:";
    }
    return isLocalOllamaHost(host);
  } catch {
    return false;
  }
}

export function providerFromHost(host: string): AiProvider {
  return isLocalOllamaHost(host) ? "ollama-local" : "ollama-cloud";
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readAiConfig(): AiConfig {
  if (!canUseStorage()) return { ...DEFAULT_AI_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    const model = parsed.model?.trim() || DEFAULT_OLLAMA_CLOUD_MODEL;
    const provider: AiProvider =
      parsed.provider === "ollama-local" ? "ollama-local" : "ollama-cloud";
    const defaultHost =
      provider === "ollama-local" ? OLLAMA_LOCAL_HOST : OLLAMA_CLOUD_HOST;
    return {
      ...DEFAULT_AI_CONFIG,
      ...parsed,
      provider,
      host: (parsed.host || defaultHost).replace(/\/$/, ""),
      model,
      fastModel: parsed.fastModel?.trim() || model || DEFAULT_OLLAMA_CLOUD_FAST_MODEL,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      enabled: Boolean(parsed.enabled),
    };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function writeAiConfig(config: AiConfig): void {
  if (!canUseStorage()) return;
  const model = config.model.trim() || DEFAULT_OLLAMA_CLOUD_MODEL;
  const provider: AiProvider =
    config.provider === "ollama-local" ? "ollama-local" : "ollama-cloud";
  const defaultHost =
    provider === "ollama-local" ? OLLAMA_LOCAL_HOST : OLLAMA_CLOUD_HOST;
  const next: AiConfig = {
    enabled: Boolean(config.enabled),
    provider,
    apiKey: config.apiKey.trim(),
    model,
    fastModel: config.fastModel?.trim() || model,
    host: (config.host || defaultHost).replace(/\/$/, ""),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("cr-ai-config-changed"));
}

export function clearAiConfig(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("cr-ai-config-changed"));
}

/**
 * Ready for AI calls from browser settings.
 * Cloud: enabled + API key + model.
 * Local: enabled + model (no key required for loopback Ollama).
 */
export function isAiConfigured(config: AiConfig = readAiConfig()): boolean {
  if (!config.enabled || !config.model.trim()) return false;
  if (config.provider === "ollama-local" || isLocalOllamaHost(config.host)) {
    return true;
  }
  return Boolean(config.apiKey.trim());
}

/** True when browser or we rely on server env key for dossier synthesis. */
export function hasBrowserModelPreference(config: AiConfig = readAiConfig()): boolean {
  return Boolean(config.model?.trim());
}

export function maskApiKey(key: string): string {
  const k = key.trim();
  if (!k) return "";
  if (k.length <= 8) return "••••••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export type AiConfigListener = () => void;

export function subscribeAiConfig(listener: AiConfigListener): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onCustom = () => listener();
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("cr-ai-config-changed", onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("cr-ai-config-changed", onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
