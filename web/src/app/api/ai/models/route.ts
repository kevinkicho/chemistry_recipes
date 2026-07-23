import { NextRequest, NextResponse } from "next/server";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/config";
import { getServerAiEnv, resolveRequestApiKey } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";

/**
 * List models on Ollama Cloud.
 * Auth: request Bearer key, else OLLAMA_CLOUD_API_KEY / OLLAMA_API_KEY from .env
 */
export async function POST(req: NextRequest) {
  try {
    const { apiKey } = resolveRequestApiKey(req.headers.get("authorization"));
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No Ollama API key. Set OLLAMA_CLOUD_API_KEY in .env (dev) or add a key in Settings → AI.",
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { host?: string };
    const env = getServerAiEnv();
    const host = (body.host || env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
    try {
      const u = new URL(host);
      if (u.protocol !== "https:" || u.hostname !== "ollama.com") {
        return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid host" }, { status: 400 });
    }

    const upstream = await fetch(`${host}/api/tags`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
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
