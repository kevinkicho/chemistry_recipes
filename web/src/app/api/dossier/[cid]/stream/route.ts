import { buildLiveDossierWithProgress } from "@/lib/dossier/pipeline";
import type { DossierProgressEvent } from "@/lib/dossier/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ cid: string }> };

/**
 * Server-Sent Events stream of dossier build progress.
 * Query: ?model=… &fastModel=… (optional user selection from AI settings).
 */
export async function GET(req: Request, ctx: Ctx) {
  const { cid: cidStr } = await ctx.params;
  const cid = Number(cidStr);
  if (!Number.isFinite(cid) || cid <= 0) {
    return new Response(JSON.stringify({ error: "Invalid CID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const modelParam = url.searchParams.get("model")?.trim() || undefined;
  const fastModelParam = url.searchParams.get("fastModel")?.trim() || undefined;
  // Basic sanitization — model ids are alphanumeric + : . - _
  const safeModel = (m?: string) =>
    m && /^[a-zA-Z0-9_.:/-]{1,128}$/.test(m) ? m : undefined;
  const model = safeModel(modelParam);
  const fastModel = safeModel(fastModelParam);

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: DossierProgressEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Keep-alive comment every 15s so proxies don't idle-out during Ollama
      const keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 15_000);

      try {
        await buildLiveDossierWithProgress(
          cid,
          (partial) => {
            send({
              ...partial,
              t: partial.t ?? 0,
            } as DossierProgressEvent);
          },
          { model, fastModel }
        );
      } catch (e) {
        send({
          type: "error",
          t: 0,
          error: e instanceof Error ? e.message : "Dossier pipeline failed",
          label: "Fatal error",
        });
      } finally {
        clearInterval(keepalive);
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
        closed = true;
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
