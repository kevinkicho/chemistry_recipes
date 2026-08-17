"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiProgressOverlay } from "@/components/dossier/ApiProgressOverlay";
import { LiveMoleculeDossier } from "@/components/dossier/LiveMoleculeDossier";
import type { DossierProgressEvent } from "@/lib/dossier/progress";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  deleteCachedDossierAndNotify,
  getCachedDossier,
  putCachedDossierAndNotify,
} from "@/lib/idb/dossierCache";
import { saveDossierSnapshot } from "@/lib/idb/dossierSnapshots";
import { DossierSnapshots } from "@/components/DossierSnapshots";
import { routes } from "@/lib/routes";
import { pushHistory } from "@/lib/search-history";
import { readAiConfig } from "@/lib/ai/config";
import { honestDensifyReadyBanner } from "@/lib/dossier/sectionHonesty";

type Phase = "checking-cache" | "loading" | "shell" | "ready" | "error";

/**
 * Streams dossier build via SSE. Shows evidence shell early (partial),
 * then full AI routes. IndexedDB caches completed builds.
 */
export function DossierClientLoader({ cid }: { cid: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceRefresh =
    searchParams.get("refresh") === "1" ||
    searchParams.get("refresh") === "true";

  const [phase, setPhase] = useState<Phase>("checking-cache");
  const [events, setEvents] = useState<DossierProgressEvent[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [dossier, setDossier] = useState<LiveDossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);
  const [snapshotKey, setSnapshotKey] = useState(0);
  const t0 = useRef(Date.now());
  const esRef = useRef<EventSource | null>(null);
  const phaseRef = useRef<Phase>("checking-cache");

  const pushEvent = useCallback((ev: DossierProgressEvent) => {
    setEvents((prev) => [...prev, ev]);
  }, []);

  const stripRefreshParam = useCallback(() => {
    if (!forceRefresh) return;
    router.replace(routes.pubchem(cid), { scroll: false });
  }, [forceRefresh, router, cid]);

  const startStream = useCallback(() => {
    t0.current = Date.now();
    phaseRef.current = "loading";
    setPhase("loading");
    setEvents([]);
    setDossier(null);
    setError(null);
    setFromCache(false);
    setCachedAt(null);
    setElapsedMs(0);

    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - t0.current);
    }, 200);

    // Pass browser-selected models so server synthesis uses the same choice as Settings → AI
    // force=1 skips durable server evidence cache (pairs with client cache delete on refresh)
    const ai = readAiConfig();
    const qs = new URLSearchParams();
    if (ai.model?.trim()) qs.set("model", ai.model.trim());
    if (ai.fastModel?.trim()) qs.set("fastModel", ai.fastModel.trim());
    if (forceRefresh) qs.set("force", "1");
    const q = qs.toString();
    const url = `/api/dossier/${cid}/stream${q ? `?${q}` : ""}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as DossierProgressEvent;
        pushEvent(data);

        if (data.type === "partial" && data.dossier) {
          // Early shell — keep compact progress, show content underneath
          setDossier(data.dossier);
          phaseRef.current = "shell";
          setPhase("shell");
          setFromCache(false);
        } else if (data.type === "complete" && data.dossier) {
          phaseRef.current = "ready";
          setDossier(data.dossier);
          setPhase("ready");
          setFromCache(false);
          setCachedAt(Date.now());
          setElapsedMs(data.t || Date.now() - t0.current);
          es.close();
          esRef.current = null;
          // Soft AI failure: densify dashboard is still the product surface
          const aiMissed =
            data.dossier.buildMode !== "ai" &&
            Boolean(
              data.dossier.synthesis?.rawError ||
                data.dossier.synthesis?.gaps?.some((g) =>
                  /Ollama|AI dual-view|OLLAMA|AI incomplete|quality-gated/i.test(
                    g
                  )
                )
            );
          if (aiMissed) {
            setError(
              data.dossier.synthesis?.rawError ||
                "AI dual-view did not finish — densified free-public dashboard is still usable. Retry when ready."
            );
          } else {
            setError(null);
          }
          void putCachedDossierAndNotify(data.dossier);
          void saveDossierSnapshot(data.dossier).then(() => {
            setSnapshotKey((k) => k + 1);
          });
          const name = data.dossier.identity?.name;
          if (name) {
            pushHistory({
              kind: "cid",
              label: name,
              href: routes.pubchem(cid),
            });
          }
          stripRefreshParam();
        } else if (data.type === "error") {
          phaseRef.current = "error";
          setError(data.error || data.detail || "Dossier build failed");
          setPhase("error");
          es.close();
          esRef.current = null;
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      if (
        es.readyState === EventSource.CLOSED &&
        (phaseRef.current === "loading" || phaseRef.current === "shell")
      ) {
        // If we already have a densify shell, keep the data dashboard rather than hard-fail
        if (phaseRef.current === "shell") {
          phaseRef.current = "ready";
          setPhase("ready");
          setError(
            "AI dual-view stream closed early — densified free-public dashboard is still usable. Retry for AI routes."
          );
          return;
        }
        phaseRef.current = "error";
        setPhase("error");
        setError(
          "Progress stream closed before densify finished. Check the server, Ollama key, and retry."
        );
      }
    };

    return () => {
      window.clearInterval(tick);
      es.close();
      esRef.current = null;
    };
  }, [cid, pushEvent, stripRefreshParam, forceRefresh]);

  useEffect(() => {
    let cancelled = false;
    let cleanupStream: (() => void) | undefined;

    async function boot() {
      phaseRef.current = "checking-cache";
      setPhase("checking-cache");
      setError(null);

      if (forceRefresh) {
        await deleteCachedDossierAndNotify(cid);
        if (cancelled) return;
        cleanupStream = startStream();
        return;
      }

      const cached = await getCachedDossier(cid);
      if (cancelled) return;

      if (cached?.dossier) {
        phaseRef.current = "ready";
        setDossier(cached.dossier);
        setFromCache(true);
        setCachedAt(cached.savedAt);
        setPhase("ready");
        setElapsedMs(0);
        const name = cached.dossier.identity?.name || cached.name;
        if (name) {
          pushHistory({
            kind: "cid",
            label: name,
            href: routes.pubchem(cid),
          });
        }
        return;
      }

      cleanupStream = startStream();
    }

    void boot();

    return () => {
      cancelled = true;
      cleanupStream?.();
      esRef.current?.close();
      esRef.current = null;
    };
  }, [cid, runId, forceRefresh, startStream]);

  const hardRefresh = useCallback(() => {
    esRef.current?.close();
    router.push(`${routes.pubchem(cid)}?refresh=1`);
  }, [router, cid]);

  const retry = useCallback(() => {
    esRef.current?.close();
    void deleteCachedDossierAndNotify(cid).then(() => {
      setRunId((n) => n + 1);
    });
  }, [cid]);

  const readyBanner = dossier
    ? honestDensifyReadyBanner({
        literatureCount: dossier.literature?.length ?? 0,
        patentCount: dossier.patents?.length ?? 0,
        conditionCount: dossier.processFacts?.sourcedConditionCount ?? 0,
        unitOpCount: dossier.processFacts?.unitOpCount ?? 0,
        traces: dossier.traces,
        fetchErrors: dossier.fetchErrors,
      })
    : null;

  // Full-screen freeze only before shell; after partial use compact banner
  const showOverlay = phase === "loading" || phase === "error";
  const showShellProgress = phase === "shell";

  return (
    <>
      <ApiProgressOverlay
        open={showOverlay}
        title={
          phase === "error" ? "Recipe build failed" : "Preparing process recipe"
        }
        subtitle={
          phase === "error"
            ? "Something went wrong. Retry when ready."
            : `CID ${cid} · free public sources only`
        }
        events={events}
        elapsedMs={elapsedMs}
        error={error}
        onCancel={phase === "error" ? retry : undefined}
      />

      {showShellProgress && dossier && readyBanner ? (
        <div className="print:hidden sticky top-[var(--app-header-height)] z-40 border-b border-teal-500/25 bg-teal-950/95 px-4 py-3 text-sm text-teal-50 backdrop-blur">
          <div className="mx-auto max-w-6xl space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-teal-300" />
              <span className="font-medium">Data dashboard ready</span>
              <span className="text-teal-200/80">
                AI dual-view structuring densified evidence…{" "}
                {Math.round(elapsedMs / 1000)}s
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-teal-100/90">
              <span className="rounded-md bg-teal-500/20 px-2 py-0.5 ring-1 ring-teal-400/30">
                {readyBanner.literature}
              </span>
              <span className="rounded-md bg-teal-500/20 px-2 py-0.5 ring-1 ring-teal-400/30">
                {readyBanner.patents}
              </span>
              <span className="rounded-md bg-teal-500/20 px-2 py-0.5 ring-1 ring-teal-400/30">
                Densify {dossier.procedureExcerpts?.length ?? 0} windows
              </span>
              <span className="rounded-md bg-teal-500/20 px-2 py-0.5 ring-1 ring-teal-400/30">
                {readyBanner.facts}
              </span>
              <span className="rounded-md bg-teal-500/20 px-2 py-0.5 ring-1 ring-teal-400/30">
                Score {dossier.evidenceScore?.score ?? "—"}/100
              </span>
              <span className="rounded-md bg-violet-500/20 px-2 py-0.5 ring-1 ring-violet-400/30">
                AI dual-view in progress
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "ready" && error ? (
        <div className="print:hidden border-b border-amber-500/30 bg-amber-950/80 px-4 py-2 text-sm text-amber-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={retry}
              className="rounded-md bg-amber-500/20 px-2 py-1 text-xs font-semibold ring-1 ring-amber-400/40 hover:bg-amber-500/30"
            >
              Retry densify + AI
            </button>
          </div>
        </div>
      ) : null}

      {phase === "checking-cache" ? (
        <div className="w-full p-6 text-sm text-slate-500">
          Looking for a saved recipe for CID {cid}…
        </div>
      ) : null}

      {phase === "error" && !dossier ? (
        <div className="w-full p-6">
          <h1 className="text-xl font-semibold text-slate-100">Could not build dossier</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Retry build
          </button>
        </div>
      ) : null}

      {(phase === "ready" || phase === "shell") && dossier ? (
        <>
          {error && phase === "ready" ? (
            <p className="print:hidden mx-auto max-w-6xl px-4 pt-4 text-xs text-amber-200/90 sm:px-6">
              {error}
            </p>
          ) : null}
          <LiveMoleculeDossier
            dossier={dossier}
            chrome={{
              fromCache,
              cachedAt,
              phase,
              onRefresh: hardRefresh,
              snapshots:
                phase === "ready" ? (
                  <DossierSnapshots
                    cid={cid}
                    refreshKey={snapshotKey}
                    onRestore={(d) => {
                      setDossier(d);
                      setFromCache(true);
                      setCachedAt(
                        d.snapshotSavedAt
                          ? Date.parse(d.snapshotSavedAt)
                          : Date.now()
                      );
                      setPhase("ready");
                      phaseRef.current = "ready";
                    }}
                  />
                ) : null,
            }}
          />
        </>
      ) : null}

      {phase === "loading" && !dossier ? (
        <div className="w-full p-6 text-sm text-slate-600" aria-hidden>
          Loading free public evidence for CID {cid}…
        </div>
      ) : null}
    </>
  );
}
