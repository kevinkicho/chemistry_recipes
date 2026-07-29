"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveDossier } from "@/lib/dossier/types";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import { answerFromEvidencePackage } from "@/lib/frontier/evidenceQa";
import { downloadProcessKnowledge } from "@/lib/frontier/exportKnowledge";
import { buildLiteratureDepthReport } from "@/lib/frontier/literatureDepth";
import {
  buildAiGuidancePackage,
  downloadAiGuidancePackage,
} from "@/lib/frontier/aiGuidancePackage";
import { runDensifyActionQueue } from "@/lib/frontier/densifyActionQueue";
import {
  downloadMarkdown,
  formatProcessKnowledgeMarkdown,
} from "@/lib/frontier/exportMarkdown";
import { routes } from "@/lib/routes";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";

/**
 * Seed Q&A, free-form evidence query, next experiments, knowledge export.
 * Densify-first: export AI guidance package for agent ingest (not full-text UI).
 */
export function EvidenceSciencePanel({
  dossier,
  onForceRegather,
}: {
  dossier: LiveDossier;
  /** Parent hard refresh (?refresh=1) for primary force densify */
  onForceRegather?: () => void;
}) {
  const router = useRouter();
  const pack = useMemo(
    () => dossier.processKnowledge || buildProcessKnowledgePackage(dossier),
    [dossier]
  );
  const litDepth = useMemo(
    () => buildLiteratureDepthReport(dossier),
    [dossier]
  );
  const guidance = useMemo(
    () => buildAiGuidancePackage(dossier),
    [dossier]
  );
  const [q, setQ] = useState("");
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);
  const [liveInsufficient, setLiveInsufficient] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);

  function ask() {
    const a = answerFromEvidencePackage(
      q,
      dossier,
      pack.conditionAtlas,
      pack.routeHypotheses
    );
    setLiveAnswer(a.answer);
    setLiveInsufficient(a.insufficientEvidence);
  }

  async function queueHighDensify() {
    setQueueBusy(true);
    setQueueStatus("Planning densify queue…");
    try {
      const res = await runDensifyActionQueue(dossier, guidance.densifyNext, {
        onlyHigh: true,
        maxNeighbors: 4,
        ingestBefore: guidance.ingestScore,
        onProgress: (m) => setQueueStatus(m),
      });
      setQueueStatus(
        res.detail +
          (res.needsPageRefresh
            ? ` · pre-refresh ingest ${guidance.ingestScore}/100`
            : "")
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

  return (
    <div
      id="evidence-science"
      className="scroll-mt-24 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/90">
            Frontier · evidence science
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-50">
              Q&amp;A · next experiments · export
            </h2>
            <FreePublicProvenance
              dossier={dossier}
              title="Evidence science"
              field="Evidence science Q&A"
              aiMode="when-parsed"
              onRegenerate={onForceRegather}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Answers only from densified free-public package. Insufficient evidence is a
            valid result. Export feeds agents and notebooks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadProcessKnowledge(dossier, pack)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Export process-knowledge.v1
          </button>
          <button
            type="button"
            onClick={() =>
              downloadMarkdown(
                `process-knowledge-${dossier.cid}.md`,
                formatProcessKnowledgeMarkdown(pack, {
                  literatureDepth: litDepth,
                })
              )
            }
            className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-100"
          >
            Export notebook Markdown
          </button>
          <button
            type="button"
            onClick={() => downloadAiGuidancePackage(dossier)}
            className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-100"
            title="Compact densify package for AI agents — atoms + procedure windows + densify-next"
          >
            Export AI guidance.v1
          </button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-6">
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5">
          <dt className="text-slate-600">AI ingest</dt>
          <dd className="font-mono text-cyan-100/90">
            {guidance.ingestScore}/100
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5">
          <dt className="text-slate-600">Observations</dt>
          <dd className="font-mono text-slate-200">
            {pack.metrics.observationCount}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5">
          <dt className="text-slate-600">Hypotheses</dt>
          <dd className="font-mono text-slate-200">
            {pack.metrics.hypothesisCount}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5">
          <dt className="text-slate-600">Conflicts</dt>
          <dd className="font-mono text-slate-200">{pack.metrics.conflictCount}</dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5">
          <dt className="text-slate-600">Lit depth</dt>
          <dd className="font-mono text-emerald-100/90">
            {pack.metrics.literatureDepthScore ?? litDepth.depthScore}/100
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5">
          <dt className="text-slate-600">Procedure chars</dt>
          <dd className="font-mono text-slate-200">
            {pack.metrics.procedureChars.toLocaleString()}
          </dd>
        </div>
      </dl>

      {guidance.densifyNext.length > 0 ? (
        <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
                Densify next · improve AI guidance
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Queue free-public harvest (OA/patents/neighbors/re-gather) — not paper previews.
              </p>
            </div>
            <button
              type="button"
              disabled={queueBusy}
              onClick={() => void queueHighDensify()}
              className="rounded-lg bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
            >
              {queueBusy
                ? "Queuing densify…"
                : `Queue high densify (${guidance.densifyNext.filter((d) => d.priority === "high").length})`}
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {guidance.densifyNext.slice(0, 5).map((a) => (
              <li key={a.id} className="text-[11px] text-slate-300">
                <span
                  className={
                    a.priority === "high"
                      ? "font-semibold text-amber-200"
                      : a.priority === "medium"
                        ? "font-medium text-slate-200"
                        : "text-slate-400"
                  }
                >
                  [{a.priority}] {a.title}
                </span>
                <span className="text-slate-500"> — {a.how}</span>
              </li>
            ))}
          </ul>
          {queueStatus ? (
            <p className="mt-2 text-[10px] text-cyan-100/80" role="status">
              {queueStatus}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Seed scientific questions
        </h3>
        <ul className="mt-2 space-y-2">
          {pack.seedAnswers.map((a) => (
            <li
              key={a.id}
              className={`rounded-lg border px-3 py-2 text-[11px] ${
                a.insufficientEvidence
                  ? "border-slate-800 bg-slate-950/40 text-slate-500"
                  : "border-emerald-500/20 bg-slate-950/50 text-slate-300"
              }`}
            >
              <div className="font-medium text-slate-200">{a.question}</div>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-400">
                {a.answer}
              </pre>
              {a.citations.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-[10px] text-teal-500/90">
                  {a.citations.slice(0, 3).map((c, i) => (
                    <li key={i}>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {c.label.slice(0, 60)}
                        </a>
                      ) : (
                        c.label.slice(0, 60)
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {a.insufficientEvidence ? (
                <span className="mt-1 inline-block text-[10px] text-amber-200/80">
                  insufficient evidence
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Ask the package
        </h3>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            placeholder="e.g. What solvents are mentioned with yields?"
            className="min-w-[16rem] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={ask}
            className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/10"
          >
            Retrieve
          </button>
        </div>
        {liveAnswer ? (
          <pre
            className={`mt-2 whitespace-pre-wrap rounded-lg border px-3 py-2 font-sans text-[11px] ${
              liveInsufficient
                ? "border-slate-800 text-slate-500"
                : "border-slate-800 text-slate-300"
            }`}
          >
            {liveAnswer}
          </pre>
        ) : null}
      </div>

      <div className="mt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Next experiments (research questions)
        </h3>
        <ul className="mt-2 space-y-2">
          {pack.nextExperiments.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ring-inset ${
                    e.priority === "high"
                      ? "bg-rose-500/15 text-rose-100 ring-rose-500/30"
                      : e.priority === "medium"
                        ? "bg-amber-500/15 text-amber-100 ring-amber-500/30"
                        : "bg-slate-800 text-slate-400 ring-slate-700"
                  }`}
                >
                  {e.priority}
                </span>
                <span className="font-medium text-slate-200">{e.question}</span>
              </div>
              <p className="mt-1 text-slate-500">{e.rationale}</p>
              <p className="text-[10px] text-slate-600">Gap: {e.gap}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
