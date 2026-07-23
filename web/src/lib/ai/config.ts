/**
 * User AI configuration for Ollama Cloud.
 * Docs: https://docs.ollama.com/cloud
 *
 * API key is stored only in the browser (localStorage). It is never written to
 * the server filesystem. When calling the app API, the key is sent per-request
 * so the Next.js route can proxy to ollama.com (avoids browser CORS issues).
 */

export const OLLAMA_CLOUD_HOST = "https://ollama.com";
export const OLLAMA_CLOUD_CHAT_PATH = "/api/chat";
export const OLLAMA_CLOUD_TAGS_PATH = "/api/tags";

/** Default cloud model (user can override). See ollama.com model library. */
export const DEFAULT_OLLAMA_CLOUD_MODEL = "gpt-oss:120b";

/**
 * Faster draft model for thin evidence (override with OLLAMA_CLOUD_FAST_MODEL).
 * Falls back to primary model if unset or identical.
 */
export const DEFAULT_OLLAMA_CLOUD_FAST_MODEL = "gpt-oss:120b";

const STORAGE_KEY = "cr-ai-config-v1";

export interface AiConfig {
  /** Master switch — when false, AI features stay off */
  enabled: boolean;
  /** Provider id (only ollama-cloud for now) */
  provider: "ollama-cloud";
  /** Ollama Cloud API key from https://ollama.com/settings/keys */
  apiKey: string;
  /** Primary model name, e.g. gpt-oss:120b */
  model: string;
  /** Optional faster model for thin-evidence synthesis */
  fastModel: string;
  /** Remote host (default https://ollama.com) */
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
    return {
      ...DEFAULT_AI_CONFIG,
      ...parsed,
      provider: "ollama-cloud",
      host: (parsed.host || OLLAMA_CLOUD_HOST).replace(/\/$/, ""),
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
  const next: AiConfig = {
    enabled: Boolean(config.enabled),
    provider: "ollama-cloud",
    apiKey: config.apiKey.trim(),
    model,
    fastModel: config.fastModel?.trim() || model,
    host: (config.host || OLLAMA_CLOUD_HOST).replace(/\/$/, ""),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("cr-ai-config-changed"));
}

export function clearAiConfig(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("cr-ai-config-changed"));
}

/** Ready for AI calls: enabled + non-empty API key + model. */
export function isAiConfigured(config: AiConfig = readAiConfig()): boolean {
  return Boolean(config.enabled && config.apiKey.trim() && config.model.trim());
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
