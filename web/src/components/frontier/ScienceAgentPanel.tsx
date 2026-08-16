"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  runScienceAgentLocal,
  runScienceAgentWithTools,
  type ScienceAgentResult,
} from "@/lib/frontier/scienceAgent";
import {
  ensureDossierKnowledge,
  packageIsUsable,
} from "@/lib/frontier/knowledgeFingerprint";
import { buildAiGuidancePackage } from "@/lib/frontier/aiGuidancePackage";
import { runDensifyActionQueue } from "@/lib/frontier/densifyActionQueue";
import { warmLiveDossier } from "@/lib/dossier/warmCache";
import { recordDensifyRun } from "@/lib/dossier/densifyTelemetry";
import { formatNeighborDensifyStatus } from "@/lib/frontier/neighborDensifyStatus";
import { routes } from "@/lib/routes";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";
import { aiProvenanceWhenParsed } from "@/lib/dossier/aiFieldProvenance";
import { ContentProvenance } from "@/components/ContentProvenance";
import { slimTraces } from "@/lib/api/trace";

/**
 * Quote-bound science agent — prefers local densify package (fast).
 * Surfaces densify-next + queue densify so users grow evidence, not paper previews.
 */
export function ScienceAgentPanel({
  dossier,
  onForceRegather,
}: {
  dossier: LiveDossier;
  onForceRegather?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState(
    "What temperature ranges appear in free-public process text?"
  );
  const [useLlm, setUseLlm] = useState(false);
  const [densifyNeighbors, setDensifyNeighbors] = useState(false);
  const [forceServer, setForceServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [lastIngest, setLastIngest] = useState<number | null>(null);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const guidance = useMemo(
    () => buildAiGuidancePackage(dossier),
    [dossier]
  );

  async function runLocal() {
    const d = ensureDossierKnowledge(dossier);
    if (densifyNeighbors) {
      const t0 = Date.now();
      const result = await runScienceAgentWithTools(q, d, {
        pack: d.processKnowledge,
        densifyNeighbors: true,
        maxNeighbors: 2,
        densifyCid: async (ncid) => {
          const nd = await warmLiveDossier(ncid, {
            force: false,
            onStatus: (s) =>
              setSteps((prev) => [...prev, `[densify] ${s}`].slice(-20)),
          });
          return nd;
        },
        useLlm: false,
      });
      recordDensifyRun({
        kind: "agent-neighbor",
        cids: [d.cid, ...(result.neighborCids || [])],
        ok: result.neighborCids?.length || 0,
        fail: result.neighborFailedCids?.length || 0,
        durationMs: Date.now() - t0,
      });
      return result;
    }
    return runScienceAgentLocal(q, d, d.processKnowledge);
  }

  async function runServer() {
    const res = await fetch("/api/ai/science", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid: dossier.cid,
        question: q,
        useLlm,
        densifyNeighbors,
        maxNeighbors: 2,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      answer?: {
        answer: string;
        insufficientEvidence?: boolean;
        citations?: Array<{ label: string; url?: string }>;
      };
      steps?: Array<{ role: string; detail: string }>;
      usedLlm?: boolean;
      modelUsed?: string;
      note?: string;
      neighborCids?: number[];
    };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function queueHighDensify() {
    setQueueBusy(true);
    setQueueStatus("Planning densify queue…");
    try {
      const before = guidance.ingestScore;
      const res = await runDensifyActionQueue(dossier, guidance.densifyNext, {
        onlyHigh: true,
        maxNeighbors: 4,
        ingestBefore: before,
        onProgress: (m) => setQueueStatus(m),
      });
      setQueueStatus(res.detail);
      setSteps((prev) =>
        [...prev, `[densify] queue: ${res.detail}`].slice(-20)
      );
      if (res.needsPageRefresh) {
        if (onForceRegather) {
          onForceRegather();
        } else {
          router.push(`${routes.pubchem(dossier.cid)}?refresh=1`);
        }
      }
    } catch (e) {
      setQueueStatus(e instanceof Error ? e.message : "Densify queue failed");
    } finally {
      setQueueBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setOut(null);
    setSteps([]);
    try {
      const d = ensureDossierKnowledge(dossier);
      const canLocal =
        !forceServer &&
        !useLlm &&
        packageIsUsable(d.processKnowledge);

      const data = canLocal
        ? await runLocal()
        : await runServer();

      // Normalize shapes
      const answer =
        "answer" in data && data.answer && typeof data.answer === "object"
          ? data.answer
          : null;
      const stepList =
        "steps" in data && Array.isArray(data.steps)
          ? data.steps.map((s: { role: string; detail: string }) =>
              `[${s.role}] ${s.detail}`
            )
          : [];
      setSteps(stepList);

      if (answer && "answer" in answer) {
        const cites = (answer.citations || [])
          .map((c: { label: string }) => c.label)
          .slice(0, 4)
          .join(" · ");
        const neighborCids =
          "neighborCids" in data
            ? (data as { neighborCids?: number[] }).neighborCids
            : undefined;
        const neighborFailedCids =
          "neighborFailedCids" in data
            ? (data as { neighborFailedCids?: number[] }).neighborFailedCids
            : undefined;
        const ingestScore =
          "ingestScore" in data &&
          typeof (data as ScienceAgentResult).ingestScore === "number"
            ? (data as ScienceAgentResult).ingestScore
            : guidance.ingestScore;
        setLastIngest(ingestScore ?? null);
        const densifyTips =
          "densifyNext" in data &&
          Array.isArray((data as ScienceAgentResult).densifyNext)
            ? (data as ScienceAgentResult).densifyNext!
            : guidance.densifyNext;
        setOut(
          [
            canLocal
              ? "mode: local densify package (efficient)"
              : "mode: server rebuild",
            ingestScore != null ? `AI ingest readiness: ${ingestScore}/100` : "",
            answer.insufficientEvidence
              ? "⚠ insufficient free-public evidence"
              : "✓ package-grounded",
            "usedLlm" in data && data.usedLlm
              ? `LLM: ${(data as { modelUsed?: string }).modelUsed || "yes"}`
              : "retrieval-only",
            formatNeighborDensifyStatus({
              requested: densifyNeighbors,
              okCids: neighborCids || [],
              failCids: neighborFailedCids || [],
            }),
            "note" in data ? String((data as { note?: string }).note || "") : "",
            "",
            answer.answer || "",
            cites ? `\nCitations: ${cites}` : "",
            densifyTips?.length
              ? `\nDensify next:\n${densifyTips
                  .slice(0, 4)
                  .map((a) => `• [${a.priority}] ${a.title} — ${a.how}`)
                  .join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
    } catch (e) {
      setOut(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setBusy(false);
    }
  }

  const highCount = guidance.densifyNext.filter((d) => d.priority === "high")
    .length;

  return (
    <div
      id="science-agent"
      className="scroll-mt-24 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">
        Frontier · science agent
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-50">
          Quote-bound scientific agent
        </h2>
        <FreePublicProvenance
          dossier={dossier}
          title="Science agent"
          field="Science agent"
          aiMode="when-parsed"
          onRegenerate={onForceRegather}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Prefer local densify package (atoms + procedure windows). Server only when LLM or
        forced densify is needed. Never invents plant numbers — densify more free-public
        data instead of previewing papers in-app.
      </p>
      <p className="mt-1 text-[10px] text-violet-300/80">
        AI ingest readiness: {lastIngest ?? guidance.ingestScore}/100 ·{" "}
        {guidance.metrics.harvestedExcerpts} excerpts ·{" "}
        {guidance.metrics.processFactConditions} conditions · {highCount} high densify
        action(s)
      </p>
      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={2}
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
      <div className="mt-2 flex flex-col gap-1.5 text-[11px] text-slate-400">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={densifyNeighbors}
            onChange={(e) => setDensifyNeighbors(e.target.checked)}
          />
          Densify network neighbor CIDs mid-loop
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
          />
          Use Ollama over package (server; optional)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={forceServer}
            onChange={(e) => setForceServer(e.target.checked)}
          />
          Force server rebuild (ignore local-fast path)
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || queueBusy || q.trim().length < 4}
          onClick={() => void run()}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {busy ? "Running agent…" : "Run agent loop"}
        </button>
        <button
          type="button"
          disabled={busy || queueBusy || highCount === 0}
          onClick={() => void queueHighDensify()}
          className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/40 disabled:opacity-40"
          title="Run high densify-next actions to grow free-public package for AI"
        >
          {queueBusy
            ? "Queuing densify…"
            : `Queue densify (${highCount})`}
        </button>
      </div>
      {queueStatus ? (
        <p className="mt-1 text-[10px] text-cyan-100/80" role="status">
          {queueStatus}
        </p>
      ) : null}
      {steps.length > 0 ? (
        <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[10px] text-slate-500">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : null}
      {out ? (
        <div className="mt-2">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Agent answer
            </span>
            <ContentProvenance
              title="Science agent answer"
              field="Science agent answer"
              pubchemCid={dossier.cid}
              traces={slimTraces(dossier.traces || [])}
              sourceRefs={dossier.sourceRefs}
              ai={useLlm ? aiProvenanceWhenParsed(dossier.synthesis) : null}
              showAi={Boolean(useLlm && aiProvenanceWhenParsed(dossier.synthesis))}
              onRegenerate={onForceRegather}
            />
            {useLlm ? (
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-200/90">
                LLM over densify package
              </span>
            ) : (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">
                retrieval-only · free-public package
              </span>
            )}
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-2 font-sans text-[11px] text-slate-300">
            {out}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
