"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PROBLEM_SEARCH_HINTS,
  searchProblemFirst,
  type ProblemSearchHit,
} from "@/lib/search/problemFirst";
import {
  cidsFromProblemHits,
  createCampaignAndDensifyFromProblemHits,
  createCampaignFromProblemHits,
} from "@/lib/search/problemCampaign";
import type { ProblemMultiSearchResult } from "@/lib/search/problemMultiSource";
import { routes } from "@/lib/routes";
import { useRouter } from "next/navigation";
import type { ProblemCampaignDensifyResult } from "@/lib/search/problemCampaign";
import {
  exportProblemDensifyNotebookFromDraft,
  loadProblemDensifyNotebookDraft,
  saveProblemDensifyNotebookDraft,
} from "@/lib/search/problemDensifyNotebook";
import { runMsatJourney } from "@/lib/search/msatJourney";

/** Guided MSAT steps — single primary flow, fewer competing CTAs. */
type MsatStep = 1 | 2 | 3 | 4;

/**
 * Home / search entry: problem or unit-op first, enriched with multi-source fan-out.
 */
export function ProblemFirstSearch() {
  const router = useRouter();
  const densifyAbortRef = useRef<AbortController | null>(null);
  const [q, setQ] = useState("");
  const [campMsg, setCampMsg] = useState<string | null>(null);
  const [liveHits, setLiveHits] = useState<ProblemSearchHit[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [densifyBusy, setDensifyBusy] = useState(false);
  const [sourcePills, setSourcePills] = useState<
    Array<{ source: string; ok: boolean; hitCount: number }>
  >([]);
  const [literatureHits, setLiteratureHits] = useState<
    ProblemMultiSearchResult["literatureHits"]
  >([]);
  const [lastDensify, setLastDensify] =
    useState<ProblemCampaignDensifyResult | null>(null);
  const [wizardStep, setWizardStep] = useState<MsatStep>(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const localHits = useMemo(() => searchProblemFirst(q, 12), [q]);
  const hits = liveHits ?? localHits;
  const { cids } = useMemo(() => cidsFromProblemHits(hits), [hits]);

  // Restore densify draft when returning from Workspace handoff
  useEffect(() => {
    const draft = loadProblemDensifyNotebookDraft();
    if (draft?.result) {
      setLastDensify(draft.result);
      if (draft.problemQuery && !q.trim()) {
        setQ(draft.problemQuery);
      }
      if (draft.agentAnswer) {
        setCampMsg(
          `Notebook draft ready with agent answer · campaign “${draft.campaignName}” · Export densify notebook .md`
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot restore
  }, []);

  // Abort densify stream if user navigates away (browser Back / leave page)
  useEffect(() => {
    return () => {
      densifyAbortRef.current?.abort();
    };
  }, []);

  // Soft warn if closing tab mid-densify (Back is handled by abort above)
  useEffect(() => {
    if (!densifyBusy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [densifyBusy]);

  // Debounced multi-source problem search
  useEffect(() => {
    const qTrim = q.trim();
    if (qTrim.length < 3) {
      setLiveHits(null);
      setStatus(null);
      setSourcePills([]);
      setLiteratureHits([]);
      setLoading(false);
      setWizardStep(1);
      return;
    }

    setLoading(true);
    setStatus("Local hits ready — multi-source enriching…");
    setWizardStep((s) => (s < 2 ? 2 : s));
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(
        `/api/search/problem?q=${encodeURIComponent(qTrim)}&limit=16`,
        { signal: ac.signal, cache: "no-store" }
      )
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return (await r.json()) as ProblemMultiSearchResult;
        })
        .then((data) => {
          if (ac.signal.aborted) return;
          setLiveHits(data.unified?.length ? data.unified : null);
          setSourcePills(data.sourceStatus || []);
          setLiteratureHits(data.literatureHits || []);
          setStatus(data.summary || null);
          setLoading(false);
          setWizardStep((s) => (s < 2 ? 2 : s));
        })
        .catch((e) => {
          if (ac.signal.aborted) return;
          if (e instanceof Error && e.name === "AbortError") return;
          setLiveHits(null);
          setLiteratureHits([]);
          setStatus("Multi-source enrich unavailable — try again or open a CID from search");
          setLoading(false);
          setWizardStep((s) => (s < 2 ? 2 : s));
        });
    }, 350);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  function spinCampaign() {
    if (!q.trim() || !cids.length) {
      setCampMsg("Need hub/live hits with PubChem CIDs to spin a campaign.");
      return;
    }
    const camp = createCampaignFromProblemHits(q, hits);
    if (!camp) {
      setCampMsg("Could not create campaign from these hits.");
      return;
    }
    setCampMsg(
      `Created science campaign “${camp.name}” · ${camp.cids.length} CID(s). Open Workspace to densify & brief.`
    );
  }

  /** Primary MSAT path: campaign → densify → route neighborhood → brief + agent */
  async function runMsatPath() {
    if (!q.trim() || !cids.length) {
      setCampMsg("Need hub/live hits with PubChem CIDs for MSAT journey.");
      return;
    }
    densifyAbortRef.current?.abort();
    const ac = new AbortController();
    densifyAbortRef.current = ac;
    setDensifyBusy(true);
    setWizardStep(3);
    setCampMsg(null);
    try {
      const res = await runMsatJourney(q, hits, {
        concurrency: 2,
        literatureHits,
        signal: ac.signal,
        expandNeighborhood: true,
        onProgress: (m) => setCampMsg(m),
      });
      if (ac.signal.aborted || res?.densify.error === "aborted") {
        setCampMsg(
          "MSAT journey cancelled (left page or aborted). Completed CIDs may still be in local cache."
        );
        setWizardStep(2);
        return;
      }
      if (!res) {
        setCampMsg("Could not create campaign from these hits.");
        setWizardStep(2);
        return;
      }
      setLastDensify(res);
      setWizardStep(4);
      saveProblemDensifyNotebookDraft({
        problemQuery: q.trim(),
        campaignId: res.campaign.id,
        campaignName: res.campaign.name,
        result: res,
        problemHits: hits,
        literatureHits,
        agentQuestion: res.agentQuestion,
      });
      setCampMsg(
        [
          `MSAT journey · “${res.campaign.name}” · densify ${res.densify.ok}ok/${res.densify.fail}fail · ${res.queueCids.length} CIDs`,
          res.neighborhoodExpanded
            ? `+${res.neighborhoodExpanded} impurity/route neighbors`
            : null,
          res.literatureAttached
            ? `lit pastes ${res.literatureAttached} (${res.literatureChars.toLocaleString()} chars)`
            : null,
          "opening brief + agent…",
        ]
          .filter(Boolean)
          .join(" · ")
      );
      router.push(res.workspaceHref);
    } catch (e) {
      setCampMsg(
        e instanceof Error ? e.message : "MSAT journey failed"
      );
    } finally {
      setDensifyBusy(false);
    }
  }

  /** Densify-only (no agent handoff, no neighborhood expand) */
  async function spinCampaignAndDensify() {
    if (!q.trim() || !cids.length) {
      setCampMsg("Need hub/live hits with PubChem CIDs to densify.");
      return;
    }
    densifyAbortRef.current?.abort();
    const ac = new AbortController();
    densifyAbortRef.current = ac;
    setDensifyBusy(true);
    setCampMsg(null);
    try {
      const res = await createCampaignAndDensifyFromProblemHits(q, hits, {
        concurrency: 2,
        literatureHits,
        signal: ac.signal,
        onProgress: (m) => setCampMsg(m),
      });
      if (ac.signal.aborted || res?.densify.error === "aborted") {
        setCampMsg(
          "Densify cancelled (left page or aborted). Completed CIDs may still be in local cache."
        );
        return;
      }
      if (!res) {
        setCampMsg("Could not create campaign from these hits.");
        return;
      }
      setLastDensify(res);
      saveProblemDensifyNotebookDraft({
        problemQuery: q.trim(),
        campaignId: res.campaign.id,
        campaignName: res.campaign.name,
        result: res,
        problemHits: hits,
        literatureHits,
      });
      setCampMsg(
        [
          `Campaign “${res.campaign.name}” · densify ${res.densify.ok}ok/${res.densify.fail}fail · ${res.queueCids.length} CIDs`,
          res.literatureAttached
            ? `lit pastes ${res.literatureAttached} (${res.literatureChars.toLocaleString()} chars)`
            : null,
          "open Workspace for brief/agent",
        ]
          .filter(Boolean)
          .join(" · ")
      );
    } catch (e) {
      setCampMsg(
        e instanceof Error ? e.message : "Campaign densify queue failed"
      );
    } finally {
      setDensifyBusy(false);
    }
  }

  function exportDensifyNotebook() {
    const draft = loadProblemDensifyNotebookDraft();
    if (draft && exportProblemDensifyNotebookFromDraft(draft)) {
      setCampMsg(
        draft.agentAnswer
          ? `Exported notebook with agent answer · ${draft.campaignName}`
          : `Exported densify notebook · ${draft.campaignName} (agent answer pending — re-export after handoff)`
      );
      return;
    }
    if (!lastDensify) {
      setCampMsg("Run Spin + densify first, then export the notebook.");
      return;
    }
    saveProblemDensifyNotebookDraft({
      problemQuery: q.trim() || lastDensify.campaign.name,
      campaignId: lastDensify.campaign.id,
      campaignName: lastDensify.campaign.name,
      result: lastDensify,
      problemHits: hits,
      literatureHits,
    });
    if (exportProblemDensifyNotebookFromDraft()) {
      setCampMsg("Exported problem densify notebook .md");
    }
  }

  const stepLabels: Array<{ step: MsatStep; label: string }> = [
    { step: 1, label: "Problem" },
    { step: 2, label: "Review CIDs" },
    { step: 3, label: "Densify" },
    { step: 4, label: "Brief + agent" },
  ];

  return (
    <div
      id="problem-first-search"
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
        MSAT wizard · problem → campaign
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">
        Guided densify journey
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        One path: state the process problem → review free-public CIDs → densify +
        impurity neighborhood → Workspace brief + agent. Not GMP.
      </p>

      {/* Stepper */}
      <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="MSAT journey steps">
        {stepLabels.map((s) => {
          const active = wizardStep === s.step;
          const done = wizardStep > s.step;
          return (
            <li
              key={s.step}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${
                active
                  ? "bg-amber-500/20 text-amber-100 ring-amber-400/50"
                  : done
                    ? "bg-emerald-500/10 text-emerald-200/90 ring-emerald-500/30"
                    : "bg-slate-900 text-slate-500 ring-slate-800"
              }`}
            >
              {s.step}. {s.label}
            </li>
          );
        })}
      </ol>

      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCampMsg(null);
          if (!e.target.value.trim()) setWizardStep(1);
        }}
        placeholder="Step 1 · e.g. hydrogenation · workup · mAb capture"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
        aria-label="Process problem or unit-op query"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {PROBLEM_SEARCH_HINTS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => {
              setQ(h);
              setCampMsg(null);
            }}
            className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700 hover:text-sky-200"
          >
            {h}
          </button>
        ))}
      </div>

      {sourcePills.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {sourcePills.slice(0, 12).map((s) => (
            <li
              key={s.source}
              className={`rounded-full px-2 py-0.5 font-mono ring-1 ring-inset ${
                s.ok
                  ? "bg-sky-500/10 text-sky-200 ring-sky-500/30"
                  : "bg-slate-900 text-slate-600 ring-slate-800"
              }`}
            >
              {s.source}
              {s.ok ? ` · ${s.hitCount}` : " · —"}
            </li>
          ))}
        </ul>
      ) : null}

      {status ? (
        <p className="mt-1 text-[11px] text-slate-500" role="status">
          {status}
          {loading ? " …" : ""}
        </p>
      ) : null}

      {q.trim() && cids.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-400">
            Step 2 · {cids.length} PubChem CID(s) ready
            {literatureHits?.length
              ? ` · ${literatureHits.length} process lit hit(s)`
              : ""}
            . Step 3 runs densify + neighbors, then opens brief + agent.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={densifyBusy}
              onClick={() => void runMsatPath()}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {densifyBusy
                ? "Step 3 · densifying…"
                : `Continue · MSAT densify + agent (${Math.min(12, cids.length)} CIDs)`}
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-400 hover:border-slate-600"
            >
              {showAdvanced ? "Hide advanced" : "Advanced"}
            </button>
            <Link
              href={routes.workspace()}
              className="text-[11px] text-violet-300/90 hover:underline"
            >
              Open Workspace →
            </Link>
          </div>
          {showAdvanced ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-2">
              <button
                type="button"
                disabled={densifyBusy}
                onClick={spinCampaign}
                className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100 disabled:opacity-40"
              >
                Spin campaign only
              </button>
              <button
                type="button"
                disabled={densifyBusy}
                onClick={() => void spinCampaignAndDensify()}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40"
              >
                Densify only
              </button>
              {lastDensify || loadProblemDensifyNotebookDraft() ? (
                <button
                  type="button"
                  onClick={exportDensifyNotebook}
                  className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-100"
                >
                  Export densify notebook .md
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {campMsg ? (
        <p className="mt-2 text-[11px] text-violet-200/90" role="status">
          {campMsg}
        </p>
      ) : null}
      {q.trim() ? (
        <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
          {hits.length === 0 ? (
            <li className="text-xs text-slate-600">
              No hub/package match — try{" "}
              <Link
                href={routes.search(q)}
                className="text-teal-400 hover:underline"
              >
                multi-source molecule search
              </Link>
              .
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <Link
                  href={h.href}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 hover:border-sky-500/30"
                  target={h.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    h.href.startsWith("http") ? "noreferrer" : undefined
                  }
                >
                  <span>
                    <span className="text-sm font-medium text-slate-100">
                      {h.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {h.subtitle}
                    </span>
                    {h.tags?.length ? (
                      <span className="mt-0.5 block text-[10px] text-slate-600">
                        {h.tags.slice(0, 5).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                    {h.kind}
                    {h.tags?.includes("literature") ? " · lit" : ""}
                    {h.tags?.includes("multi-source") ? " · multi" : ""}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
