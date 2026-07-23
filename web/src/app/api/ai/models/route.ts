import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedOllamaHost,
  isLocalOllamaHost,
  OLLAMA_CLOUD_HOST,
} from "@/lib/ai/config";
import { getServerAiEnv, resolveRequestApiKey } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";

/**
 * List models on Ollama Cloud or local Ollama.
 * Cloud requires API key; local loopback/LAN does not.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { host?: string };
    const env = getServerAiEnv();
    const host = (body.host || env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
    if (!isAllowedOllamaHost(host)) {
      return NextResponse.json(
        {
          error:
            "Host not allowed. Use https://ollama.com or a local/LAN Ollama host.",
        },
        { status: 400 }
      );
    }

    const local = isLocalOllamaHost(host);
    const { apiKey } = resolveRequestApiKey(req.headers.get("authorization"));
    if (!local && !apiKey) {
      return NextResponse.json(
        {
          error:
            "No Ollama API key. Set OLLAMA_CLOUD_API_KEY in .env or Settings → AI. Local Ollama needs no key.",
        },
        { status: 401 }
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(`${host}/api/tags`, { headers });

    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 500) || `HTTP ${upstream.status}` };
    }

    if (!upstream.ok) {
      const err =
        typeof data === "object" &&
        data &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : `Ollama error (HTTP ${upstream.status})`;
      return NextResponse.json({ error: err }, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 500 }
    );
  }
}
