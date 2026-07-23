import { NextRequest, NextResponse } from "next/server";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/config";
import { getServerAiEnv, resolveRequestApiKey } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";

/**
 * Proxy chat to Ollama Cloud.
 * Auth: request Bearer key, else OLLAMA_CLOUD_API_KEY / OLLAMA_API_KEY from .env
 * Docs: https://docs.ollama.com/cloud
 */
export async function POST(req: NextRequest) {
  try {
    const { apiKey, source } = resolveRequestApiKey(req.headers.get("authorization"));
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No Ollama API key. Set OLLAMA_CLOUD_API_KEY in .env (dev) or add a key in Settings → AI.",
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      host?: string;
      model?: string;
      messages?: Array<{ role: string; content: string }>;
      stream?: boolean;
    };

    const env = getServerAiEnv();
    const host = (body.host || env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
    if (!isAllowedHost(host)) {
      return NextResponse.json(
        { error: "Host not allowed. Use https://ollama.com for Ollama Cloud." },
        { status: 400 }
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

    const upstream = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
          : `Ollama Cloud error (HTTP ${upstream.status})`;
      return NextResponse.json(
        { error: err, raw: data, keySource: source },
        { status: upstream.status }
      );
    }

    // Attach non-sensitive meta for debugging
    if (data && typeof data === "object") {
      return NextResponse.json({ ...(data as object), keySource: source });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 500 }
    );
  }
}

function isAllowedHost(host: string): boolean {
  try {
    const u = new URL(host);
    return u.protocol === "https:" && u.hostname === "ollama.com";
  } catch {
    return false;
  }
}
