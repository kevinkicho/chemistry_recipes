"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { routes } from "@/lib/routes";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { HUB_INDEX } from "@/lib/data/hubIndex";

/**
 * Side-by-side launch pad for two live CIDs or examples (opens dossiers in parallel).
 */
function CompareInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [left, setLeft] = useState(sp.get("a") || "");
  const [right, setRight] = useState(sp.get("b") || "");

  const hub = HUB_INDEX;

  function resolveHref(raw: string): string | null {
    const t = raw.trim();
    if (!t) return null;
    if (/^\d+$/.test(t)) return routes.pubchem(t);
    if (t.startsWith("/")) return t;
    const h = hub.find(
      (e) =>
        e.exampleId === t.toLowerCase() ||
        e.name.toLowerCase() === t.toLowerCase() ||
        String(e.pubchemCid) === t ||
        e.cas === t
    );
    if (h?.kind === "example" && h.exampleId) return routes.example(h.exampleId);
    if (h?.pubchemCid) return routes.pubchem(h.pubchemCid);
    return routes.search(t);
  }

  function onOpen() {
    const a = resolveHref(left);
    const b = resolveHref(right);
    if (!a || !b) {
      alert("Enter two CIDs, CAS numbers, example ids, or catalog names");
      return;
    }
    router.replace(`/compare?a=${encodeURIComponent(left)}&b=${encodeURIComponent(right)}`);
    // Open both — primary navigates left; right in new tab for dual monitor MSAT workflow
    window.open(b, "_blank", "noopener,noreferrer");
    router.push(a);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Compare recipes
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Launch two dossiers for dual-monitor route scouting. Enter PubChem CIDs, CAS, example
        ids (e.g. <code className="text-slate-300">aspirin</code>), or catalog names. Right
        side opens in a new tab; left replaces this view.
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
            placeholder="CID, CAS, or name"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            list="compare-suggest"
          />
        </label>
      </div>
      <datalist id="compare-suggest">
        {hub.map((e) => (
          <option
            key={`${e.kind}-${e.pubchemCid}`}
            value={e.exampleId || String(e.pubchemCid)}
          >
            {e.name}
          </option>
        ))}
      </datalist>

      <button
        type="button"
        onClick={onOpen}
        className="mt-6 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
      >
        Open A + B
      </button>

      <p className="mt-6 text-xs text-slate-500">
        For step-level compare inside one dossier, use <strong>Route compare</strong> on the
        molecule page. Workspace pins also support pin-to-pin metadata compare.{" "}
        <Link href={routes.workspace()} className="text-teal-400 hover:underline">
          Workspace
        </Link>
      </p>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-500">Loading compare…</div>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
