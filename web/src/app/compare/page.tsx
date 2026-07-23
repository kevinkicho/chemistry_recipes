"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { routes } from "@/lib/routes";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { HUB_INDEX } from "@/lib/data/hubIndex";
import { getCachedDossier } from "@/lib/idb/dossierCache";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  buildTechTransferFromLive,
  downloadJson,
  slugifyName,
} from "@/lib/export/techTransfer";
import { getExampleById } from "@/lib/data/examples";
import { TechTransferExport } from "@/components/TechTransferExport";

type Resolved =
  | { kind: "cid"; cid: number; label: string; href: string }
  | { kind: "example"; id: string; label: string; href: string }
  | { kind: "search"; q: string; label: string; href: string };

function resolveInput(raw: string): Resolved | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const cid = Number(t);
    return {
      kind: "cid",
      cid,
      label: `CID ${cid}`,
      href: routes.pubchem(cid),
    };
  }
  const hub = HUB_INDEX.find(
    (e) =>
      e.exampleId === t.toLowerCase() ||
      e.name.toLowerCase() === t.toLowerCase() ||
      e.cas === t ||
      String(e.pubchemCid) === t
  );
  if (hub?.kind === "example" && hub.exampleId) {
    return {
      kind: "example",
      id: hub.exampleId,
      label: hub.name,
      href: routes.example(hub.exampleId),
    };
  }
  if (hub?.pubchemCid) {
    return {
      kind: "cid",
      cid: hub.pubchemCid,
      label: hub.name,
      href: routes.pubchem(hub.pubchemCid),
    };
  }
  const ex = getExampleById(t.toLowerCase());
  if (ex) {
    return {
      kind: "example",
      id: ex.id,
      label: ex.identifiers.name,
      href: routes.example(ex.id),
    };
  }
  return { kind: "search", q: t, label: t, href: routes.search(t) };
}

function CompareInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [left, setLeft] = useState(sp.get("a") || "");
  const [right, setRight] = useState(sp.get("b") || "");
  const [dossierA, setDossierA] = useState<LiveDossier | null>(null);
  const [dossierB, setDossierB] = useState<LiveDossier | null>(null);

  const resA = useMemo(() => resolveInput(left), [left]);
  const resB = useMemo(() => resolveInput(right), [right]);

  const loadCaches = useCallback(async () => {
    setDossierA(null);
    setDossierB(null);
    if (resA?.kind === "cid") {
      const c = await getCachedDossier(resA.cid);
      if (c?.dossier) setDossierA(c.dossier);
    }
    if (resB?.kind === "cid") {
      const c = await getCachedDossier(resB.cid);
      if (c?.dossier) setDossierB(c.dossier);
    }
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

  function exportBoth() {
    if (!dossierA && !dossierB) {
      alert("Open and cache both live dossiers first (visit each page once).");
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
        Side-by-side scouting for two entities. Visit each live dossier once so IndexedDB can
        cache them for metrics and dual export — no collaborative sharing.
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
            placeholder="CID, CAS, or name"
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
            placeholder="CID, CAS, or name"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            list="compare-suggest"
          />
        </label>
      </div>
      <datalist id="compare-suggest">
        {HUB_INDEX.map((e) => (
          <option
            key={`${e.kind}-${e.pubchemCid}`}
            value={e.exampleId || String(e.pubchemCid)}
          >
            {e.name}
          </option>
        ))}
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
          onClick={exportBoth}
          className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          Export both (JSON)
        </button>
      </div>

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
              <dt className="text-slate-600">Mode</dt>
              <dd className="text-slate-200">{dossier.buildMode || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Lit / patents</dt>
              <dd className="text-slate-200">
                {dossier.literature.length} · {dossier.patents.length}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">Multi-source</dt>
              <dd className="text-slate-200">
                {dossier.annotations?.length ?? 0} annotations
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
          <p>No IndexedDB cache yet for this CID.</p>
          <Link
            href={resolved.href}
            className="inline-block text-teal-400 hover:underline"
            onClick={() => {
              // user will return — refresh cache when they come back
              window.setTimeout(onRefreshCache, 500);
            }}
          >
            Build live dossier →
          </Link>
        </div>
      ) : resolved.kind === "example" ? (
        <p className="mt-4 text-xs text-slate-500">
          Curated Tier-A example — open full page for dual-view recipe. Dual export uses live
          caches only.
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Resolve via search, then open a PubChem CID for live compare metrics.
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
