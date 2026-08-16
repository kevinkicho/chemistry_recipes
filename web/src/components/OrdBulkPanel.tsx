"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ORD_BULK,
  clearOrdBulkSnippets,
  listOrdBulkSnippets,
  ordBrowseUrl,
  saveOrdBulkSnippet,
} from "@/lib/api/ordBulk";
import {
  analyzeOrdSnippet,
  attachOrdSnippetToCid,
  createCampaignFromOrdSnippets,
  ordBridgeInventory,
} from "@/lib/frontier/ordCampaignBridge";
import { routes } from "@/lib/routes";
import { ContentProvenance } from "@/components/ContentProvenance";

/**
 * ORD offline bulk hooks — deep links + local snippet index (user-controlled).
 * Bridges to densify paste + science campaigns.
 */
export function OrdBulkPanel({
  name,
  smiles,
  cid,
}: {
  name: string;
  smiles?: string;
  cid?: number;
}) {
  const component = smiles || name;
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const rows = listOrdBulkSnippets(name);
  void tick;
  const inv = ordBridgeInventory();

  return (
    <div
      id="ord-bulk"
      className="print:hidden scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">ORD offline / bulk hooks</h2>
        <ContentProvenance
          title="ORD bulk hooks"
          field="ORD bulk"
          pubchemCid={cid}
          showNotAi
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{ORD_BULK.note}</p>
      <p className="mt-1 text-[10px] text-slate-600">{inv.summary}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <a
          href={ordBrowseUrl(component)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-teal-300 hover:border-teal-500/40"
        >
          Browse ORD for {name.slice(0, 40)}
        </a>
        <a
          href={ORD_BULK.datasetUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-slate-600"
        >
          Bulk dataset (GitHub)
        </a>
        <a
          href={ORD_BULK.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-slate-600"
        >
          ORD docs
        </a>
      </div>
      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Paste ORD / reaction snippet (local index only)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Optional: paste a public ORD reaction condition window…"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-200"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const row = saveOrdBulkSnippet({
              query: name,
              text,
              sourceUrl: ordBrowseUrl(component),
            });
            if (!row) {
              setMsg("Need ~40+ characters of public ORD text.");
              return;
            }
            setText("");
            const a = analyzeOrdSnippet(row);
            setMsg(
              `Saved ORD snippet (${row.chars} chars) · procedure score ${a.procedureScore}` +
                (a.attachCids.length
                  ? ` · linked CIDs ${a.attachCids.slice(0, 4).join(",")}`
                  : "")
            );
            setTick((n) => n + 1);
          }}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
        >
          Save local ORD snippet
        </button>
        {cid ? (
          <button
            type="button"
            onClick={() => {
              const latest = listOrdBulkSnippets(name)[0];
              if (!latest) {
                setMsg("Save an ORD snippet first, then attach to this CID.");
                return;
              }
              const res = attachOrdSnippetToCid(cid, latest);
              setMsg(
                res.ok
                  ? `Attached ORD text to CID ${cid} (${res.chars} chars) — re-extract process facts (paste wizard path).`
                  : res.error || "Attach failed"
              );
              setTick((n) => n + 1);
            }}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
          >
            Attach latest ORD → this CID densify
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const camp = createCampaignFromOrdSnippets({
              centerCid: cid,
              centerLabel: name,
              snippets: listOrdBulkSnippets(),
            });
            if (!camp) {
              setMsg(
                "Need ORD snippets with CID mentions, or a dossier CID."
              );
              return;
            }
            setMsg(
              `ORD science campaign “${camp.name}” · ${camp.cids.length} CID(s). Open Workspace to densify.`
            );
            setTick((n) => n + 1);
          }}
          className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100"
        >
          Spin ORD → science campaign
        </button>
        <Link
          href={routes.workspace()}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-violet-300 hover:border-violet-500/40"
        >
          Workspace →
        </Link>
        <button
          type="button"
          onClick={() => {
            clearOrdBulkSnippets();
            setMsg("Cleared local ORD index.");
            setTick((n) => n + 1);
          }}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400"
        >
          Clear index
        </button>
      </div>
      {cid ? (
        <p className="mt-1 text-[10px] text-slate-600">
          CID {cid} · snippets for name: {rows.length} · global CIDs linked:{" "}
          {inv.uniqueCids.length}
        </p>
      ) : null}
      {msg ? <p className="mt-1 text-[11px] text-teal-300/90">{msg}</p> : null}
      {rows.length > 0 ? (
        <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-500">
          {rows.slice(0, 6).map((r) => {
            const a = analyzeOrdSnippet(r);
            return (
              <li key={r.id} className="truncate">
                {r.chars} chars · score {a.procedureScore}
                {a.attachCids.length
                  ? ` · CIDs ${a.attachCids.slice(0, 3).join(",")}`
                  : ""}{" "}
                · {r.text.slice(0, 60)}…
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
