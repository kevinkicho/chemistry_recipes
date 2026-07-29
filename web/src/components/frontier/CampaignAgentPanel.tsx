"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  clearCampaignAgentHandoff,
  listCampaigns,
  peekCampaignAgentHandoff,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";
import {
  runCampaignAgent,
  type CampaignAgentResult,
} from "@/lib/frontier/campaignAgent";
import {
  campaignStatuses,
  thinOrMissingCids,
  type CampaignCidStatus,
} from "@/lib/frontier/campaignKnowledge";
import { recordDensifyRun } from "@/lib/dossier/densifyTelemetry";
import {
  batchDensifyCids,
  streamBatchDensifyCids,
} from "@/lib/dossier/batchClient";
import {
  buildCampaignKnowledgeExport,
  downloadCampaignKnowledge,
} from "@/lib/frontier/campaignExport";
import {
  appendAgentAnswerToNotebookDraft,
  exportProblemDensifyNotebookFromDraft,
  loadProblemDensifyNotebookDraft,
} from "@/lib/search/problemDensifyNotebook";
import { FreePublicBadge } from "@/components/FreePublicProvenance";

const DEFAULT_Q =
  "What condition ranges appear across this campaign? Any edge conflicts?";

/**
 * Campaign-level quote-bound Q&A over merged multi-CID caches.
 * Deep-link: ?campaign=id&agent=1&q=... or session handoff after problem densify.
 */
export function CampaignAgentPanel() {
  const searchParams = useSearchParams();
  const autoRanRef = useRef(false);
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [selected, setSelected] = useState("");
  const [q, setQ] = useState(DEFAULT_Q);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [exps, setExps] = useState<string[]>([]);
  const [useServer, setUseServer] = useState(false);
  const [useLlm, setUseLlm] = useState(false);
  const [force, setForce] = useState(false);
  const [health, setHealth] = useState<CampaignCidStatus[] | null>(null);
  const [healthMsg, setHealthMsg] = useState<string | null>(null);
  const [lastAgent, setLastAgent] = useState<CampaignAgentResult | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [autoAskAfterQueue, setAutoAskAfterQueue] = useState(true);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);

  const reload = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [selected]);

  useEffect(() => {
    reload();
    return subscribeCampaigns(reload);
  }, [reload]);

  // URL / session handoff: select campaign and optionally auto-run agent
  useEffect(() => {
    if (autoRanRef.current) return;
    const urlCamp = searchParams.get("campaign")?.trim() || "";
    const urlAgent = searchParams.get("agent") === "1";
    const urlQ = searchParams.get("q")?.trim() || "";
    const handoff = peekCampaignAgentHandoff();

    const campaignId = urlCamp || handoff?.campaignId || "";
    const question =
      urlQ ||
      handoff?.question ||
      (handoff?.problemQuery
        ? `What free-public process conditions and unit-op evidence appear for problem “${handoff.problemQuery}” across this campaign?`
        : "");
    const shouldAuto =
      urlAgent || Boolean(handoff?.autoRun && handoff.campaignId);

    if (campaignId) {
      setSelected(campaignId);
      if (question) setQ(question);
      if (handoff?.problemQuery) {
        setHandoffNote(
          `Opened from problem densify “${handoff.problemQuery}”` +
            (handoff.literatureAttached
              ? ` · ${handoff.literatureAttached} lit pastes`
              : "") +
            " · campaign agent ready"
        );
      }
      // Prefer brief first if handoff asks, else agent
      const scrollId =
        handoff?.openBrief || searchParams.get("brief") === "1"
          ? "campaign-brief"
          : "campaign-agent";
      window.setTimeout(() => {
        document
          .getElementById(scrollId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }

    if (shouldAuto && campaignId) {
      autoRanRef.current = true;
      const camp = listCampaigns().find((c) => c.id === campaignId);
      const ask = (question || DEFAULT_Q).trim();
      if (camp && ask.length >= 4) {
        setQ(ask);
        void (async () => {
          setBusy(true);
          setOut(null);
          setSteps(["[retrieve] Auto-run after problem densify handoff…"]);
          try {
            // Brief panel may need handoff first; clear after agent starts
            window.setTimeout(() => clearCampaignAgentHandoff(), 1500);
            const res = await runCampaignAgent(camp, ask);
            setLastAgent(res);
            setSteps(res.steps.map((s) => `[${s.role}] ${s.detail}`));
            setExps(
              res.nextExperiments
                .slice(0, 5)
                .map((e) => `${e.priority}: ${e.question}`)
            );
            setOut(
              [
                "mode: handoff auto-ask (local cache after densify + lit pastes)",
                res.answer.insufficientEvidence
                  ? "⚠ insufficient free-public evidence"
                  : "✓ campaign-grounded",
                `cached ${res.metrics.cachedCount}/${res.metrics.requestedCount} · obs ${res.metrics.totalObservations}`,
                "",
                res.answer.answer,
              ].join("\n")
            );
            appendAgentAnswerToNotebookDraft({
              campaignId: camp.id,
              question: ask,
              answer: res.answer.answer,
              insufficientEvidence: res.answer.insufficientEvidence,
            });
            // After agent, jump to agent panel if brief was first
            if (handoff?.openBrief || searchParams.get("brief") === "1") {
              window.setTimeout(() => {
                document
                  .getElementById("campaign-agent")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 400);
            }
          } catch (e) {
            setOut(
              e instanceof Error ? e.message : "Auto campaign agent failed"
            );
            clearCampaignAgentHandoff();
          } finally {
            setBusy(false);
          }
        })();
      }
    }
  }, [searchParams]);

  const refreshHealth = useCallback(async (camp: ScienceCampaign) => {
    const statuses = await campaignStatuses(camp.cids, camp.labels);
    setHealth(statuses);
    const cached = statuses.filter((s) => s.cached).length;
    const obs = statuses.reduce((n, s) => n + (s.observationCount || 0), 0);
    const queue = thinOrMissingCids(statuses);
    const missing = statuses.filter((s) => !s.cached).length;
    const thin = queue.length - missing;
    setHealthMsg(
      `Local package: ${cached}/${camp.cids.length} cached · ${obs} atlas obs` +
        (missing ? ` · ${missing} not densified` : "") +
        (thin > 0 ? ` · ${thin} thin` : "") +
        (queue.length ? ` · queue ${queue.length}` : "")
    );
    return statuses;
  }, []);

  // Preflight: how dense is the local campaign package?
  useEffect(() => {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) {
      setHealth(null);
      setHealthMsg(null);
      setLastAgent(null);
      return;
    }
    let cancelled = false;
    void refreshHealth(camp).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [selected, campaigns, refreshHealth]);

  const queueCids = useMemo(
    () => (health ? thinOrMissingCids(health) : []),
    [health]
  );

  async function densifyQueue() {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp || !queueCids.length) return;
    setBusy(true);
    setOut(null);
    setLastAgent(null);
    setSteps([`[densify] Auto-queue thin/missing: ${queueCids.join(", ")}`]);
    const beforeIdeal = new Map(
      (health || []).map((s) => [s.cid, s.idealScore ?? 0] as const)
    );
    try {
      const res = await streamBatchDensifyCids(queueCids, {
        includeDossiers: true,
        cacheLocal: true,
        concurrency: 2,
        force: false,
        retries: 2,
        onProgress: (m) =>
          setSteps((prev) => [...prev, `[densify] ${m}`].slice(-24)),
        onEvent: (ev) => {
          if (ev.type === "cid_complete" && ev.cid != null) {
            const b = beforeIdeal.get(ev.cid);
            const a = ev.summary?.idealScore;
            const delta =
              b != null || a != null
                ? ` ideal ${b ?? "—"}→${a ?? "—"}`
                : "";
            setSteps((prev) =>
              [
                ...prev,
                `[densify] CID ${ev.cid}: ${
                  ev.ok ? "ok" : ev.error || "fail"
                } · obs ${ev.summary?.observationCount ?? "—"}${delta}`,
              ].slice(-24)
            );
          }
        },
      });
      await refreshHealth(camp);
      setOut(
        `Thin/missing queue densify · ${res.ok}ok/${res.fail}fail · ${Math.round(res.durationMs / 1000)}s · not GMP`
      );

      // Next-slice: auto-ask campaign package after queue densify fills cache
      if (autoAskAfterQueue && res.ok > 0 && q.trim().length >= 4) {
        setSteps((prev) => [
          ...prev,
          "[retrieve] Auto-ask after densify queue…",
        ]);
        const agentRes = await runCampaignAgent(camp, q);
        setLastAgent(agentRes);
        setSteps((prev) => [
          ...prev,
          ...agentRes.steps.map((s) => `[${s.role}] ${s.detail}`),
        ]);
        setExps(
          agentRes.nextExperiments
            .slice(0, 5)
            .map((e) => `${e.priority}: ${e.question}`)
        );
        appendAgentAnswerToNotebookDraft({
          campaignId: camp.id,
          question: q,
          answer: agentRes.answer.answer,
          insufficientEvidence: agentRes.answer.insufficientEvidence,
        });
        setOut(
          [
            `mode: densify queue → auto-ask`,
            `densify ${res.ok}ok/${res.fail}fail`,
            agentRes.answer.insufficientEvidence
              ? "⚠ insufficient free-public evidence"
              : "✓ campaign-grounded",
            `cached ${agentRes.metrics.cachedCount}/${agentRes.metrics.requestedCount} · obs ${agentRes.metrics.totalObservations}`,
            "",
            agentRes.answer.answer,
          ].join("\n")
        );
      }
    } catch (e) {
      setOut(e instanceof Error ? e.message : "Queue densify failed");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp || q.trim().length < 4) return;
    setBusy(true);
    setOut(null);
    setSteps([]);
    setExps([]);
    setLastAgent(null);
    setExportMsg(null);
    const t0 = Date.now();
    try {
      let res: CampaignAgentResult;
      let densify: Array<{ cid: number; ok: boolean; error?: string }> | undefined;
      // LLM requires server path (Ollama over campaign-ai-guidance package)
      const serverMode = useServer || useLlm;
      if (serverMode) {
        const r = await fetch("/api/ai/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cids: camp.cids,
            question: q,
            name: camp.name,
            concurrency: 2,
            force,
            useLlm,
          }),
        });
        const data = (await r.json()) as CampaignAgentResult & {
          error?: string;
          densify?: Array<{ cid: number; ok: boolean; error?: string }>;
          note?: string;
        };
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        res = data;
        densify = data.densify;
        const ok = densify?.filter((d) => d.ok).length ?? 0;
        const fail = densify?.filter((d) => !d.ok).length ?? 0;
        recordDensifyRun({
          kind: "campaign-server",
          cids: camp.cids,
          concurrency: 2,
          ok,
          fail,
          durationMs: Date.now() - t0,
          detail: [
            force ? "force densify" : "campaign densify",
            useLlm ? "llm-guidance" : "retrieval",
            res.meanIngestScore != null
              ? `mean ingest ${res.meanIngestScore}`
              : "",
          ]
            .filter(Boolean)
            .join(" + "),
          meanIngestAfter: res.meanIngestScore,
        });
      } else {
        res = await runCampaignAgent(camp, q);
      }
      setLastAgent(res);
      setSteps(res.steps.map((s) => `[${s.role}] ${s.detail}`));
      setExps(
        res.nextExperiments
          .slice(0, 5)
          .map((e) => `${e.priority}: ${e.question}`)
      );
      appendAgentAnswerToNotebookDraft({
        campaignId: camp.id,
        question: q,
        answer: res.answer.answer,
        insufficientEvidence: res.answer.insufficientEvidence,
      });
      const densifyLine =
        densify && densify.length
          ? `densify ${densify.filter((d) => d.ok).length}/${densify.length}${
              densify.some((d) => !d.ok)
                ? ` · fail: ${densify
                    .filter((d) => !d.ok)
                    .map((d) => d.cid)
                    .join(",")}`
                : ""
            }`
          : null;
      setOut(
        [
          serverMode
            ? `mode: server densify + merge${force ? " (force)" : ""}${useLlm ? " · LLM over campaign-ai-guidance" : ""}`
            : "mode: local IndexedDB cache",
          densifyLine,
          res.usedLlm
            ? `LLM: ${res.modelUsed || "yes"}`
            : useLlm
              ? "retrieval-only (LLM skipped or unavailable)"
              : "retrieval-only",
          res.answer.insufficientEvidence
            ? "⚠ insufficient free-public evidence"
            : "✓ campaign-grounded",
          `cached ${res.metrics.cachedCount}/${res.metrics.requestedCount} · obs ${res.metrics.totalObservations} · edges ${res.metrics.networkEdges}` +
            (res.meanIngestScore != null
              ? ` · AI ingest mean ${res.meanIngestScore}/100`
              : ""),
          res.densifyQueueCids?.length
            ? `densify queue: ${res.densifyQueueCids.join(", ")}`
            : "",
          "",
          res.answer.answer,
        ]
          .filter(Boolean)
          .join("\n")
      );
      // Warm local IndexedDB from server batch (uses evidence cache when possible)
      if (serverMode && densify?.some((d) => d.ok)) {
        const warmCids = densify.filter((d) => d.ok).map((d) => d.cid);
        setSteps((prev) => [
          ...prev,
          `[densify] Warming local cache for ${warmCids.length} CID(s)…`,
        ]);
        try {
          await batchDensifyCids(warmCids, {
            cacheLocal: true,
            concurrency: 2,
            force: false,
            includeDossiers: false,
          });
          await refreshHealth(camp);
          setSteps((prev) => [
            ...prev,
            `[densify] Local cache warm complete`,
          ]);
        } catch {
          setSteps((prev) => [
            ...prev,
            "[densify] Local cache warm skipped (answer still valid from server package)",
          ]);
        }
      }
    } catch (e) {
      setOut(e instanceof Error ? e.message : "Campaign agent failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportWithAgent() {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) return;
    setExportMsg("Building campaign-knowledge export…");
    try {
      const data = await buildCampaignKnowledgeExport(camp, {
        agentResult: lastAgent || undefined,
      });
      downloadCampaignKnowledge(
        data,
        lastAgent
          ? `campaign-agent-${camp.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 32)}.json`
          : undefined
      );
      setExportMsg(
        lastAgent
          ? `Exported campaign-knowledge.v1 + agent run · ${data.metrics.packageCount} packages`
          : `Exported campaign-knowledge.v1 · ${data.metrics.packageCount} packages (no agent run yet)`
      );
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : "Export failed");
    }
  }

  const camp = campaigns.find((c) => c.id === selected);
  const missingCids =
    health?.filter((s) => !s.cached).map((s) => s.cid) || [];

  return (
    <div
      id="campaign-agent"
      className="scroll-mt-24 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"
      data-content-provenance="campaign-agent"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">
        Frontier · campaign agent
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-50">
          Multi-CID science agent
        </h2>
        <FreePublicBadge note="quote-bound · free-public densify packages · not GMP" />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Answers only from campaign densify (merged atlas + network). No plant
        invention. Stream densify thin/missing from preflight, or use server mode.
        Problem search can hand off here after densify with auto-ask.
      </p>
      {handoffNote ? (
        <p
          className="mt-2 rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1.5 text-[11px] text-violet-100/90"
          role="status"
        >
          {handoffNote}
        </p>
      ) : null}

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">
        Campaign
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="">— select —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.cids.length} CIDs)
            </option>
          ))}
        </select>
      </label>

      {healthMsg ? (
        <p
          className={`mt-2 text-[11px] ${
            queueCids.length || (health && health.every((s) => !s.cached))
              ? "text-amber-200/90"
              : "text-slate-400"
          }`}
          role="status"
        >
          {healthMsg}
          {queueCids.length > 0 ? (
            <span className="block text-[10px] text-amber-200/70">
              Auto-queue: {queueCids.slice(0, 8).join(", ")}
              {queueCids.length > 8 ? "…" : ""} (missing or &lt;2 atlas obs)
            </span>
          ) : null}
        </p>
      ) : null}

      {health && health.length > 0 ? (
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-600">
          {health.map((s) => {
            const needs = !s.cached || (s.observationCount ?? 0) < 2;
            return (
              <li
                key={s.cid}
                className={needs ? "text-amber-200/70" : undefined}
              >
                CID {s.cid}
                {s.name ? ` ${s.name.slice(0, 24)}` : ""} ·{" "}
                {s.cached ? `obs ${s.observationCount ?? 0}` : "not cached"} ·
                ideal {s.idealScore ?? "—"}
                {needs ? " · queue" : ""}
              </li>
            );
          })}
        </ul>
      ) : null}

      {queueCids.length > 0 ? (
        <div className="mt-2 space-y-1">
          <button
            type="button"
            disabled={busy || !selected}
            onClick={() => void densifyQueue()}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
          >
            {busy
              ? autoAskAfterQueue
                ? "Densify + auto-ask…"
                : "Densifying queue…"
              : `Densify thin/missing (${queueCids.length})`}
          </button>
          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={autoAskAfterQueue}
              onChange={(e) => setAutoAskAfterQueue(e.target.checked)}
            />
            Auto-ask question after queue densify completes
          </label>
        </div>
      ) : null}

      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
      <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        <input
          type="checkbox"
          checked={useServer}
          onChange={(e) => setUseServer(e.target.checked)}
        />
        Server densify CIDs then answer (slower, fresher free-public data)
      </label>
      <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
        <input
          type="checkbox"
          checked={useLlm}
          onChange={(e) => {
            setUseLlm(e.target.checked);
            if (e.target.checked) setUseServer(true);
          }}
        />
        Use Ollama over campaign-ai-guidance package (server; quote-bound)
      </label>
      {useServer ? (
        <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          Force re-gather (skip server evidence cache)
        </label>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !selected || q.trim().length < 4}
          onClick={() => void run()}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {busy
            ? useServer
              ? "Densifying + answering…"
              : "Running…"
            : "Ask campaign package"}
        </button>
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => void exportWithAgent()}
          className="rounded-lg border border-violet-500/40 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-100 disabled:opacity-40"
        >
          {lastAgent
            ? "Export knowledge + agent run"
            : "Export campaign-knowledge"}
        </button>
        {loadProblemDensifyNotebookDraft()?.campaignId === selected ||
        lastAgent ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (selected && lastAgent) {
                appendAgentAnswerToNotebookDraft({
                  campaignId: selected,
                  question: q,
                  answer: lastAgent.answer.answer,
                  insufficientEvidence: lastAgent.answer.insufficientEvidence,
                });
              }
              if (exportProblemDensifyNotebookFromDraft()) {
                setExportMsg(
                  "Exported problem densify notebook .md (with agent answer when available)"
                );
              } else {
                setExportMsg(
                  "No problem densify draft in session — run Spin + densify from home first"
                );
              }
            }}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-100 disabled:opacity-40"
          >
            Export densify notebook .md
          </button>
        ) : null}
      </div>
      {camp && !useServer && missingCids.length === camp.cids.length ? (
        <p className="mt-1 text-[10px] text-amber-200/80">
          No local densify yet — densify thin/missing queue or enable server mode.
        </p>
      ) : null}
      {exportMsg ? (
        <p className="mt-1 text-[10px] text-violet-200/80" role="status">
          {exportMsg}
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
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-2 font-sans text-[11px] text-slate-300">
          {out}
        </pre>
      ) : null}
      {exps.length > 0 ? (
        <div className="mt-2">
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">
            Edge / campaign experiments
          </h3>
          <ul className="mt-1 space-y-1 text-[10px] text-slate-400">
            {exps.map((e) => (
              <li key={e}>· {e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
