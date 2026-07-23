import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedOllamaHost,
  isLocalOllamaHost,
  OLLAMA_CLOUD_HOST,
} from "@/lib/ai/config";
import { getServerAiEnv, resolveRequestApiKey } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";

/**
 * Proxy chat to Ollama Cloud or local Ollama.
 * Cloud: Bearer key from request or OLLAMA_CLOUD_API_KEY / OLLAMA_API_KEY.
 * Local: no key required (loopback / private LAN allowlist).
 * Docs: https://docs.ollama.com/cloud
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      host?: string;
      model?: string;
      messages?: Array<{ role: string; content: string }>;
      stream?: boolean;
      provider?: string;
    };

    const env = getServerAiEnv();
    const host = (body.host || env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
    if (!isAllowedOllamaHost(host)) {
      return NextResponse.json(
        {
          error:
            "Host not allowed. Use https://ollama.com (Cloud) or a local/LAN Ollama host (e.g. http://127.0.0.1:11434).",
        },
        { status: 400 }
      );
    }

    const local = isLocalOllamaHost(host);
    const { apiKey, source } = resolveRequestApiKey(req.headers.get("authorization"));
    if (!local && !apiKey) {
      return NextResponse.json(
        {
          error:
            "No Ollama API key. Set OLLAMA_CLOUD_API_KEY in .env (dev) or add a key in Settings → AI. Local Ollama needs no key.",
        },
        { status: 401 }
      );
    }

    const model = (body.model || env.model).trim();
    const messages = body.messages;
    if (!model || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Body must include model and messages[]" },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

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
      return NextResponse.json(
        {
          error: err,
          raw: data,
          keySource: source,
          hostMode: local ? "local" : "cloud",
        },
        { status: upstream.status }
      );
    }

    if (data && typeof data === "object") {
      return NextResponse.json({
        ...(data as object),
        keySource: source ?? (local ? "local" : null),
        hostMode: local ? "local" : "cloud",
      });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 500 }
    );
  }
}
