"use client";

import { useEffect, useMemo, useState } from "react";
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
import { setCampaignAgentHandoff } from "@/lib/workspace/campaigns";
import { routes } from "@/lib/routes";
import { useRouter } from "next/navigation";
import {
  downloadMarkdown,
  formatProblemDensifyRunMarkdown,
} from "@/lib/frontier/exportMarkdown";
import type { ProblemCampaignDensifyResult } from "@/lib/search/problemCampaign";

/**
 * Home / search entry: problem or unit-op first, enriched with multi-source fan-out.
 */
export function ProblemFirstSearch() {
  const router = useRouter();
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

  const localHits = useMemo(() => searchProblemFirst(q, 12), [q]);
  const hits = liveHits ?? localHits;
  const { cids } = useMemo(() => cidsFromProblemHits(hits), [hits]);

  // Debounced multi-source problem search
  useEffect(() => {
    const qTrim = q.trim();
    if (qTrim.length < 3) {
      setLiveHits(null);
      setStatus(null);
      setSourcePills([]);
      setLiteratureHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatus("Local hits ready — multi-source enriching…");
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
        })
        .catch((e) => {
          if (ac.signal.aborted) return;
          if (e instanceof Error && e.name === "AbortError") return;
          setLiveHits(null);
          setLiteratureHits([]);
          setStatus("Multi-source enrich unavailable — showing local hub hits");
          setLoading(false);
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

  async function spinCampaignAndDensify(opts?: { openAgent?: boolean }) {
    if (!q.trim() || !cids.length) {
      setCampMsg("Need hub/live hits with PubChem CIDs to densify.");
      return;
    }
    const openAgent = opts?.openAgent !== false;
    setDensifyBusy(true);
    setCampMsg(null);
    try {
      const res = await createCampaignAndDensifyFromProblemHits(q, hits, {
        concurrency: 2,
        literatureHits,
        onProgress: (m) => setCampMsg(m),
      });
      if (!res) {
        setCampMsg("Could not create campaign from these hits.");
        return;
      }
      setLastDensify(res);
      const agentQ = `What free-public process conditions and unit-op evidence appear for “${q.trim()}” across this campaign? Any edge conflicts?`;
      setCampMsg(
        [
          `Campaign “${res.campaign.name}” · densify ${res.densify.ok}ok/${res.densify.fail}fail · ${res.queueCids.length} CIDs`,
          res.literatureAttached
            ? `lit pastes ${res.literatureAttached} (${res.literatureChars.toLocaleString()} chars)`
            : null,
          openAgent ? "opening brief + agent…" : "open Workspace for brief/agent",
        ]
          .filter(Boolean)
          .join(" · ")
      );
      if (openAgent) {
        setCampaignAgentHandoff({
          campaignId: res.campaign.id,
          question: agentQ,
          autoRun: true,
          openBrief: true,
          problemQuery: q.trim(),
          literatureAttached: res.literatureAttached,
        });
        router.push(
          routes.workspace({
            campaign: res.campaign.id,
            agent: true,
            brief: true,
            q: agentQ,
          })
        );
      }
    } catch (e) {
      setCampMsg(
        e instanceof Error ? e.message : "Campaign densify queue failed"
      );
    } finally {
      setDensifyBusy(false);
    }
  }

  function exportDensifyNotebook() {
    if (!lastDensify) {
      setCampMsg("Run Spin + densify first, then export the notebook.");
      return;
    }
    const md = formatProblemDensifyRunMarkdown({
      problemQuery: q.trim() || lastDensify.campaign.name,
      result: lastDensify,
      problemHits: hits,
      literatureHits,
    });
    const slug = (q.trim() || "problem")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    downloadMarkdown(`problem-densify-${slug}.md`, md);
    setCampMsg(`Exported problem densify notebook · ${slug}.md`);
  }

  return (
    <div
      id="problem-first-search"
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
        Problem / unit-op search
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">
        Start from the process problem
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Rank hub molecules, training packages, multi-source free-public CIDs, and
        process literature by unit op or problem language (e.g. crystallization,
        mAb capture). Spin a multi-CID science campaign from live hits.
      </p>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCampMsg(null);
        }}
        placeholder="e.g. hydrogenation · workup · gene therapy downstream"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={densifyBusy}
            onClick={spinCampaign}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            Spin science campaign ({cids.length} CIDs)
          </button>
          <button
            type="button"
            disabled={densifyBusy}
            onClick={() => void spinCampaignAndDensify({ openAgent: true })}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
          >
            {densifyBusy
              ? "Densifying → agent…"
              : `Spin + densify + agent (${Math.min(12, cids.length)})`}
          </button>
          <button
            type="button"
            disabled={densifyBusy}
            onClick={() => void spinCampaignAndDensify({ openAgent: false })}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-40"
          >
            Densify only
          </button>
          {lastDensify ? (
            <button
              type="button"
              onClick={exportDensifyNotebook}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-100"
            >
              Export densify notebook .md
            </button>
          ) : null}
          <Link
            href={routes.workspace()}
            className="text-[11px] text-violet-300/90 hover:underline"
          >
            Open Workspace →
          </Link>
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
