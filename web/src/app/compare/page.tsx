"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { routes } from "@/lib/routes";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { getCachedDossier } from "@/lib/idb/dossierCache";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  buildTechTransferFromLive,
  downloadJson,
  slugifyName,
} from "@/lib/export/techTransfer";
import { TechTransferExport } from "@/components/TechTransferExport";
import { warmLiveDossier } from "@/lib/dossier/warmCache";
import { CompareMsatBoard } from "@/components/CompareMsatBoard";
import {
  normalizeChemicalQuery,
  parsePubchemCidQuery,
} from "@/lib/search/queryKind";

type Resolved =
  | { kind: "cid"; cid: number; label: string; href: string }
  | { kind: "search"; q: string; label: string; href: string };

function resolveInput(raw: string): Resolved | null {
  const t = normalizeChemicalQuery(raw);
  if (!t) return null;
  const parsedCid = parsePubchemCidQuery(t);
  if (parsedCid) {
    const cid = parsedCid;
    return {
      kind: "cid",
      cid,
      label: `CID ${cid}`,
      href: routes.pubchem(cid),
    };
  }
  // Names and CAS open live search — only numeric PubChem CIDs warm a dossier.
  // Prefixed IDs (CID 2244, PubChem URL, InChIKey=) submit as written.
  return { kind: "search", q: t, label: t, href: routes.search(t) };
}

function CompareInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [left, setLeft] = useState(sp.get("a") || "");
  const [right, setRight] = useState(sp.get("b") || "");
  const [dossierA, setDossierA] = useState<LiveDossier | null>(null);
  const [dossierB, setDossierB] = useState<LiveDossier | null>(null);
  const [warming, setWarming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const resA = useMemo(() => resolveInput(left), [left]);
  const resB = useMemo(() => resolveInput(right), [right]);

  const loadCaches = useCallback(async () => {
    if (resA?.kind === "cid") {
      const c = await getCachedDossier(resA.cid);
      if (c?.dossier) setDossierA(c.dossier);
    } else setDossierA(null);
    if (resB?.kind === "cid") {
      const c = await getCachedDossier(resB.cid);
      if (c?.dossier) setDossierB(c.dossier);
    } else setDossierB(null);
  }, [resA, resB]);

  useEffect(() => {
    void loadCaches();
  }, [loadCaches]);

  function applyUrl() {
    const params = new URLSearchParams();
    if (left.trim()) params.set("a", left.trim());
    if (right.trim()) params.set("b", right.trim());
    router.replace(`/compare?${params.toString()}`);
  }

  async function warmBoth(force = false) {
    const cids: number[] = [];
    if (resA?.kind === "cid") cids.push(resA.cid);
    if (resB?.kind === "cid") cids.push(resB.cid);
    if (!cids.length) {
      alert("Enter a PubChem CID on at least one side. Molecule names open live search; they do not warm a dossier.");
      return;
    }
    setWarming(true);
    setStatus("Warming live dossiers…");
    try {
      const results = await Promise.all(
        cids.map((cid) =>
          warmLiveDossier(cid, {
            force,
            onStatus: (s) => setStatus(s),
          })
        )
      );
      if (resA?.kind === "cid") {
        const d = results[cids.indexOf(resA.cid)] || null;
        if (d) setDossierA(d);
      }
      if (resB?.kind === "cid") {
        const d = results[cids.indexOf(resB.cid)] || null;
        if (d) setDossierB(d);
      }
      setStatus("Warm complete — dual export ready when both sides loaded.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Warm failed");
    } finally {
      setWarming(false);
    }
  }

  function exportBoth() {
    if (!dossierA && !dossierB) {
      alert("Warm or open both live dossiers first.");
      return;
    }
    const pack = {
      schema: "chemistry-recipes.compare-export.v1" as const,
      exportedAt: new Date().toISOString(),
      a: dossierA ? buildTechTransferFromLive(dossierA) : null,
      b: dossierB ? buildTechTransferFromLive(dossierB) : null,
      links: { a: resA?.href, b: resB?.href },
    };
    const name = [
      dossierA?.identity?.name || resA?.label || "a",
      dossierB?.identity?.name || resB?.label || "b",
    ]
      .map(slugifyName)
      .join("-vs-");
    downloadJson(`${name}-compare.json`, pack);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Compare recipes
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Side-by-side scouting for two entities — use{" "}
        <strong className="font-medium text-slate-300">PubChem CIDs</strong> or molecule names
        (names open live search).{" "}
        <strong className="font-medium text-slate-300">Warm both</strong> streams live densify
        + AI dual-view into IndexedDB for dual export. No mock example dossiers.
      </p>
      <div className="mt-4">
        <RegulatoryDisclaimer compact />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Recipe A
          </span>
          <input
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            onBlur={applyUrl}
            placeholder="PubChem CID or name"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            list="compare-suggest"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Recipe B
          </span>
          <input
            value={right}
            onChange={(e) => setRight(e.target.value)}
            onBlur={applyUrl}
            placeholder="PubChem CID or name"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            list="compare-suggest"
          />
        </label>
      </div>
      <datalist id="compare-suggest">
        <option value="2244">Aspirin (CID 2244)</option>
      </datalist>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyUrl}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
        >
          Update compare
        </button>
        <button
          type="button"
          disabled={warming}
          onClick={() => void warmBoth(false)}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {warming ? "Warming…" : "Warm both (stream + cache)"}
        </button>
        <button
          type="button"
          disabled={warming}
          onClick={() => void warmBoth(true)}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-40"
        >
          Force rebuild both
        </button>
        <button
          type="button"
          onClick={exportBoth}
          className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          Export both (JSON)
        </button>
      </div>
      {status ? (
        <p className="mt-2 text-xs text-slate-500" role="status">
          {status}
        </p>
      ) : null}

      <CompareMsatBoard a={dossierA} b={dossierB} />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <ComparePane
          title="A"
          resolved={resA}
          dossier={dossierA}
          onRefreshCache={() => void loadCaches()}
        />
        <ComparePane
          title="B"
          resolved={resB}
          dossier={dossierB}
          onRefreshCache={() => void loadCaches()}
        />
      </div>
    </div>
  );
}

function ComparePane({
  title,
  resolved,
  dossier,
  onRefreshCache,
}: {
  title: string;
  resolved: Resolved | null;
  dossier: LiveDossier | null;
  onRefreshCache: () => void;
}) {
  if (!resolved) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-500">
        Enter recipe {title}
      </div>
    );
  }

  return (
    <article className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Recipe {title}
          </div>
          <h2 className="text-lg font-semibold text-slate-50">{resolved.label}</h2>
          <p className="text-xs text-slate-500">{resolved.kind}</p>
        </div>
        <Link
          href={resolved.href}
          className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-200 hover:bg-teal-500/15"
        >
          Open full page
        </Link>
      </div>

      {dossier ? (
        <div className="mt-4 space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-slate-600">Evidence</dt>
              <dd className="text-slate-200">
                {dossier.evidenceScore?.score ?? "—"} / 100 ·{" "}
                {dossier.evidenceScore?.confidence || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">Framing</dt>
              <dd className="text-slate-200">
                {dossier.processFraming ||
                  dossier.processFacts?.framing ||
                  "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">Accuracy</dt>
              <dd className="text-slate-200">
                {dossier.processFacts?.metrics?.accuracyScore ?? "—"}/100
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">Lit / patents</dt>
              <dd className="text-slate-200">
                {dossier.literature.length} · {dossier.patents.length}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-600">Routes</dt>
              <dd className="text-slate-300">
                {dossier.processRoutes.map((r) => r.name).join(" · ") || "—"}
              </dd>
            </div>
          </dl>
          {dossier.synthesis.overview || dossier.descriptionTexts[0] ? (
            <p className="line-clamp-4 text-xs leading-relaxed text-slate-400">
              {dossier.synthesis.overview || dossier.descriptionTexts[0]}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <TechTransferExport
              source={{ kind: "live", dossier }}
              compact
            />
          </div>
        </div>
      ) : resolved.kind === "cid" ? (
        <div className="mt-4 space-y-2 text-xs text-slate-500">
          <p>No IndexedDB cache yet — use Warm both above.</p>
          <Link
            href={resolved.href}
            className="inline-block text-teal-400 hover:underline"
            onClick={() => {
              window.setTimeout(onRefreshCache, 500);
            }}
          >
            Or open live dossier →
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Resolve via search to a PubChem CID, then warm for live compare metrics.
        </p>
      )}
    </article>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-slate-500">Loading compare…</div>}
    >
      <CompareInner />
    </Suspense>
  );
}
