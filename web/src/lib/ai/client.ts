/**
 * Client-side AI helper for Ollama Cloud.
 * Uses browser-saved key when present; otherwise relies on server .env
 * (OLLAMA_CLOUD_API_KEY) via the proxy routes.
 */

import {
  isAiConfigured,
  readAiConfig,
  type AiConfig,
} from "@/lib/ai/config";

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatResult {
  ok: boolean;
  content?: string;
  model?: string;
  error?: string;
  raw?: unknown;
  keySource?: "request" | "env";
}

export interface ServerAiStatus {
  envKeyConfigured: boolean;
  envKeySource: string | null;
  model: string;
  fastModel?: string;
  host: string;
}

export async function fetchServerAiStatus(): Promise<ServerAiStatus | null> {
  try {
    const res = await fetch("/api/ai/status", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ServerAiStatus;
  } catch {
    return null;
  }
}

function authHeaders(config: AiConfig): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Only send Bearer when the user pasted a key; otherwise server uses .env
  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  return headers;
}

/**
 * Call Ollama Cloud chat through the app proxy.
 * Works with browser key OR server OLLAMA_CLOUD_API_KEY from .env.
 */
export async function aiChat(
  messages: AiChatMessage[],
  opts?: { model?: string; stream?: false; allowEnvFallback?: boolean }
): Promise<AiChatResult> {
  const config = readAiConfig();
  const allowEnv = opts?.allowEnvFallback !== false;

  if (!config.apiKey.trim() && !allowEnv) {
    return {
      ok: false,
      error:
        "AI is not configured. Open Settings → AI and add your Ollama Cloud API key.",
    };
  }

  // If user explicitly disabled AI and has no local key, respect that only when no env either
  // (env is for development). Local enabled=false + no key → still try env for dev.
  if (!config.enabled && config.apiKey.trim() && !isAiConfigured(config)) {
    return {
      ok: false,
      error: "AI is disabled in Settings → AI.",
    };
  }

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: authHeaders(config),
      body: JSON.stringify({
        host: config.host,
        model: opts?.model || config.model,
        messages,
        stream: false,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      message?: { content?: string };
      model?: string;
      keySource?: "request" | "env";
    };

    if (!res.ok) {
      return {
        ok: false,
        error: data.error || `AI request failed (HTTP ${res.status})`,
        raw: data,
        keySource: data.keySource,
      };
    }

    const content = data.message?.content;
    if (!content) {
      return { ok: false, error: "Empty response from Ollama Cloud", raw: data };
    }

    return {
      ok: true,
      content,
      model: data.model,
      raw: data,
      keySource: data.keySource,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "AI request failed",
    };
  }
}

/** Normalize Ollama /api/tags (or similar) into sorted unique model ids. */
export function parseOllamaModelList(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const raw = Array.isArray(root.models)
    ? root.models
    : Array.isArray(root)
      ? root
      : [];
  const names = raw
    .map((m) => {
      if (typeof m === "string") return m.trim();
      if (m && typeof m === "object") {
        const o = m as { name?: string; model?: string };
        return (o.name || o.model || "").trim();
      }
      return "";
    })
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export async function listAiModels(config?: AiConfig): Promise<{
  ok: boolean;
  models: string[];
  error?: string;
}> {
  const cfg = config ?? readAiConfig();

  try {
    const res = await fetch("/api/ai/models", {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify({ host: cfg.host }),
    });
    const data = (await res.json()) as {
      error?: string;
      models?: unknown;
    };
    if (!res.ok) {
      return {
        ok: false,
        models: [],
        error: data.error || `HTTP ${res.status}`,
      };
    }
    return { ok: true, models: parseOllamaModelList(data) };
  } catch (e) {
    return {
      ok: false,
      models: [],
      error: e instanceof Error ? e.message : "Failed to list models",
    };
  }
}

export async function testAiConnection(config?: AiConfig): Promise<{
  ok: boolean;
  message: string;
}> {
  const cfg = config ?? readAiConfig();

  const listed = await listAiModels(cfg);
  if (listed.ok) {
    const n = listed.models.length;
    return {
      ok: true,
      message:
        n > 0
          ? `Connected to Ollama Cloud · ${n} model(s) listed`
          : "Connected to Ollama Cloud (no models returned in tags)",
    };
  }

  try {
    const result = await fetch("/api/ai/chat", {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify({
        host: cfg.host,
        model: cfg.model,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
        stream: false,
      }),
    });
    const data = (await result.json()) as {
      error?: string;
      message?: { content?: string };
      keySource?: string;
    };
    if (!result.ok) {
      return { ok: false, message: data.error || listed.error || "Connection failed" };
    }
    const via = data.keySource === "env" ? " (via .env)" : "";
    return {
      ok: true,
      message: `Chat OK${via} · ${data.message?.content?.slice(0, 80) || "response received"}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : listed.error || "Connection failed",
    };
  }
}
