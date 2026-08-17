"use client";

import { useState } from "react";
import type { LiveDossier } from "@/lib/dossier/types";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";
import { downloadSiteHandoff } from "@/lib/export/siteHandoff";
import { failedFamiliesFromErrors } from "@/lib/dossier/densifyDelta";
import { assessMondayPath } from "@/lib/dossier/mondayPath";
import { runDensifyActionQueue } from "@/lib/frontier/densifyActionQueue";
import { readWorkerRole } from "@/lib/worker/roleMode";
import { densifyRouteNeighborhood } from "@/lib/frontier/routeNeighborhood";

/**
 * Monday path: thin scout → densify-next → job aid / handoff. Always actionable.
 */
export function ThinToUsefulBanner({
  dossier,
  onScroll,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onScroll: (id: string) => void;
  onRegenerate?: () => void;
}) {
  const role = readWorkerRole();
  const path = assessMondayPath(dossier, role);
  const softN = failedFamiliesFromErrors(dossier.fetchErrors).length;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function queueHighDensify() {
    if (!path.highDensify.length && !onRegenerate) {
      setMsg("No high densify-next actions — force densify or paste public text.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (path.highDensify.length) {
        const res = await runDensifyActionQueue(dossier, path.highDensify, {
          onlyHigh: true,
          streamPrimary: false,
          ingestBefore: path.ingestScore,
          onProgress: (m) => setMsg(m),
        });
        setMsg(res.detail);
        if (res.needsPageRefresh && onRegenerate) {
          onRegenerate();
          return;
        }
        if (res.densifiedCids.length) {
          setMsg(
            `${res.detail} · densified ${res.densifiedCids.join(", ")}. Refresh if primary still thin.`
          );
        }
      } else if (onRegenerate) {
        onRegenerate();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Densify queue failed");
    } finally {
      setBusy(false);
    }
  }

  async function densifyNeighbors() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await densifyRouteNeighborhood(dossier, {
        maxNeighbors: 6,
        onProgress: (m) => setMsg(m),
      });
      setMsg(
        res.queueCids.length
          ? `Neighborhood · ${res.queueCids.length} CID(s) · ${res.densify.ok}ok/${res.densify.fail}fail`
          : "No impurity/intermediate PubChem CIDs on this dossier yet."
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Neighborhood densify failed");
    } finally {
      setBusy(false);
    }
  }

  if (!path.thin) {
    return (
      <div
        id="thin-to-useful"
        className="print:hidden scroll-mt-24 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3"
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
            Monday path · ready for handoff pack
          </p>
          {/* Composite all-traces hydration. Empty traces must not
              live-fetch leftover PubChem identity HTTP labeled as
              Thin-to-useful. */}
          <FreePublicProvenance
            dossier={dossier}
            title="Monday path"
            field="Thin-to-useful"
            liveFetch={false}
            onRegenerate={onRegenerate}
          />
        </div>
        <p className="text-xs text-emerald-100/90">
          <strong className="font-semibold">Live densify depth:</strong> evidence{" "}
          {path.score}/100 · ideal {path.ideal}/100 · ingest {path.ingestScore}/100 ·{" "}
          {path.facts} process facts · {path.mode}
          {softN ? ` · ${softN} soft-fail family(ies)` : ""}. Still not GMP.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn onClick={() => onScroll("monday-pack")} label="Monday pack" />
          <Btn onClick={() => onScroll("operator-job-aid")} label="Job aid" />
          <Btn onClick={() => onScroll("shift-pack")} label="Shift pack" />
          <Btn onClick={() => onScroll("procedure-vault")} label="Procedure vault" />
          <Btn onClick={() => downloadSiteHandoff(dossier)} label="Site handoff .md" />
          <Btn onClick={() => onScroll("ideal-page-parity")} label="Ideal gaps" />
          <Btn onClick={() => onScroll("batch-densify")} label="Route neighborhood" />
        </div>
      </div>
    );
  }

  const topActions = path.highDensify.slice(0, 3);

  return (
    <div
      id="thin-to-useful"
      className="print:hidden scroll-mt-24 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 ring-1 ring-amber-400/20"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
          Monday path · densify first (primary)
        </p>
        {/* Composite all-traces hydration. Empty traces must not
            live-fetch leftover PubChem identity HTTP labeled as
            Thin-to-useful. */}
        <FreePublicProvenance
          dossier={dossier}
          title="Thin to useful"
          field="Thin-to-useful"
          liveFetch={false}
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-sm text-slate-200">
        Live densify is below useful floor (evidence {path.score}/100 · ideal{" "}
        {path.ideal}/100 · ingest {path.ingestScore}/100 · {path.facts} facts ·{" "}
        {path.mode}
        {softN ? ` · ${softN} soft-fail family(ies)` : ""}). Harvest free-public
        procedure text — never invent plant limits. Science lab is secondary until density rises.
      </p>
      {topActions.length ? (
        <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
          {topActions.map((a) => (
            <li key={a.id}>
              <span className="font-medium text-amber-100/90">{a.title}</span>
              {" — "}
              {a.rationale}
            </li>
          ))}
        </ul>
      ) : (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[11px] text-slate-400">
          <li>Queue high densify / force re-gather</li>
          <li>Paste public experimental text into vault</li>
          <li>Impurity / route neighborhood densify</li>
          <li>Monday pack / role pack for the plant team</li>
        </ol>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Btn
          primary
          disabled={busy}
          onClick={() => void queueHighDensify()}
          label={busy ? "Densifying…" : "1 · Queue high densify"}
        />
        {onRegenerate ? (
          <Btn
            disabled={busy}
            onClick={onRegenerate}
            label="Force densify"
          />
        ) : null}
        <Btn
          disabled={busy}
          onClick={() => onScroll("local-text-enrich")}
          label="2 · Paste wizard"
        />
        <Btn
          disabled={busy}
          onClick={() => onScroll("procedure-vault")}
          label="Vault"
        />
        <Btn
          disabled={busy}
          onClick={() => void densifyNeighbors()}
          label="3 · Route neighborhood"
        />
        <Btn onClick={() => onScroll("ideal-page-parity")} label="Ideal gaps" />
        <Btn onClick={() => onScroll("monday-pack")} label="Monday pack" />
        <Btn onClick={() => downloadSiteHandoff(dossier)} label="Site handoff .md" />
      </div>
      {msg ? (
        <p className="mt-2 text-[11px] text-amber-100/90" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

function Btn({
  onClick,
  label,
  primary,
  disabled,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? "rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
          : "rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-500/40 disabled:opacity-40"
      }
    >
      {label}
    </button>
  );
}
