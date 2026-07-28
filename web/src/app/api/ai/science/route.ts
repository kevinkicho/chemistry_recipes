/**
 * Quote-bound scientific agent over a CID's process-knowledge package.
 * Body: { cid, question, useLlm?, densifyNeighbors?, maxNeighbors? }
 */

import { NextRequest, NextResponse } from "next/server";
import { buildLiveDossierWithProgress } from "@/lib/dossier/pipeline";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import {
  runScienceAgentLocal,
  runScienceAgentWithTools,
} from "@/lib/frontier/scienceAgent";
import {
  isAllowedOllamaHost,
  isLocalOllamaHost,
  OLLAMA_CLOUD_HOST,
} from "@/lib/ai/config";
import { getServerAiEnv, resolveRequestApiKey } from "@/lib/ai/serverEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: {
    cid?: number;
    question?: string;
    useLlm?: boolean;
    densifyNeighbors?: boolean;
    maxNeighbors?: number;
    model?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cid = Number(body.cid);
  const question = (body.question || "").trim();
  if (!Number.isFinite(cid) || cid <= 0) {
    return NextResponse.json({ error: "cid required" }, { status: 400 });
  }
  if (question.length < 4) {
    return NextResponse.json(
      { error: "question required (min 4 chars)" },
      { status: 400 }
    );
  }

  const maxNeighbors = Math.min(
    3,
    Math.max(0, Number(body.maxNeighbors) || 2)
  );

  try {
    const dossier = await buildLiveDossierWithProgress(cid, () => undefined, {
      model: body.model,
    });
    const pack = dossier.processKnowledge || buildProcessKnowledgePackage(dossier);

    const densifyCid = async (ncid: number) => {
      try {
        return await buildLiveDossierWithProgress(ncid, () => undefined, {
          model: body.model,
        });
      } catch {
        return null;
      }
    };

    const wantLlm = Boolean(body.useLlm);
    const densifyNeighbors = body.densifyNeighbors !== false; // default true when tools run

    if (!wantLlm && !body.densifyNeighbors) {
      const result = runScienceAgentLocal(question, dossier, pack);
      return NextResponse.json({
        schema: "chemistry-recipes.science-agent.v1",
        ...result,
        cid,
        moleculeName: dossier.identity?.name,
      });
    }

    let chat:
      | ((args: {
          system: string;
          user: string;
        }) => Promise<{
          ok: boolean;
          content?: string;
          model?: string;
          error?: string;
        }>)
      | undefined;

    if (wantLlm) {
      const env = getServerAiEnv();
      const host = (env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
      const local = isLocalOllamaHost(host);
      const { apiKey } = resolveRequestApiKey(req.headers.get("authorization"));
      if (isAllowedOllamaHost(host) && (local || apiKey)) {
        const model = (body.model || env.model).trim();
        chat = async ({ system, user }) => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
          const upstream = await fetch(`${host}/api/chat`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: system },
                { role: "user", content: user },
              ],
              stream: false,
            }),
          });
          const text = await upstream.text();
          let data: { message?: { content?: string }; error?: string } = {};
          try {
            data = JSON.parse(text) as typeof data;
          } catch {
            return { ok: false, error: text.slice(0, 200) };
          }
          if (!upstream.ok) {
            return {
              ok: false,
              error: data.error || `HTTP ${upstream.status}`,
              model,
            };
          }
          return {
            ok: true,
            content: data.message?.content || "",
            model,
          };
        };
      }
    }

    const result = await runScienceAgentWithTools(question, dossier, {
      pack,
      densifyCid:
        densifyNeighbors || body.densifyNeighbors ? densifyCid : undefined,
      densifyNeighbors: densifyNeighbors || Boolean(body.densifyNeighbors),
      maxNeighbors,
      chat,
      useLlm: wantLlm && Boolean(chat),
    });

    return NextResponse.json({
      schema: "chemistry-recipes.science-agent.v1",
      ...result,
      cid,
      moleculeName: dossier.identity?.name,
      note:
        wantLlm && !chat
          ? "LLM unavailable (key/host) — retrieval + densify tools only"
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Science agent failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/ai/science",
    body: {
      cid: 2244,
      question: "What impurities relate via free-public evidence?",
      useLlm: false,
      densifyNeighbors: true,
      maxNeighbors: 2,
    },
    note: "Quote-bound agent; optional densify of network neighbor CIDs; optional Ollama over package only.",
  });
}
