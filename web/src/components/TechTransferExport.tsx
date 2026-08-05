"use client";

import { useEffect, useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  buildAgentPack,
  buildMesLimsFromTechTransfer,
  buildOperatorJobAidExport,
  buildPublicProcessBrief,
  buildTechTransferFromLive,
  downloadJson,
  slugifyName,
} from "@/lib/export/techTransfer";
import { buildRolePack } from "@/lib/export/rolePack";
import {
  readWorkerRole,
  subscribeWorkerRole,
  type WorkerRole,
} from "@/lib/worker/roleMode";

/**
 * Print/PDF + tech-transfer / role / agent JSON downloads (live densify only).
 */
export function TechTransferExport({
  source,
  compact = false,
}: {
  source: { kind: "live"; dossier: LiveDossier };
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [workerRole, setWorkerRole] = useState<WorkerRole>("chemist");

  useEffect(() => {
    setWorkerRole(readWorkerRole());
    return subscribeWorkerRole(setWorkerRole);
  }, []);

  function pack() {
    return buildTechTransferFromLive(source.dossier);
  }

  function nameBase() {
    const p = pack();
    return slugifyName(p.entity.name || "entity");
  }

  function onPrint() {
    window.print();
  }

  function onTechTransferJson() {
    const p = pack();
    downloadJson(`${nameBase()}-tech-transfer-v2.json`, p);
    const gaps = p.validationChecklist?.filter((c) => c.status === "gap").length ?? 0;
    const review = p.validationChecklist?.filter((c) => c.status === "review").length ?? 0;
    if (gaps + review > 0) {
      console.info(
        `[tech-transfer] validation checklist: ${gaps} gap(s), ${review} review item(s)`
      );
    }
  }

  function onMesLimsJson() {
    const p = pack();
    downloadJson(`${nameBase()}-mes-lims.json`, buildMesLimsFromTechTransfer(p));
  }

  function onPublicProcessBrief() {
    downloadJson(
      `${nameBase()}-public-process-brief.json`,
      buildPublicProcessBrief(source.dossier)
    );
  }

  function onOperatorJobAid() {
    downloadJson(
      `${nameBase()}-operator-job-aid.json`,
      buildOperatorJobAidExport(source.dossier)
    );
  }

  function onAgentPack() {
    downloadJson(`${nameBase()}-agent-pack-v1.json`, buildAgentPack(source.dossier));
  }

  function onRolePack() {
    const rp = buildRolePack(source.dossier, workerRole);
    downloadJson(`${nameBase()}-role-pack-${workerRole}-v1.json`, rp);
  }

  if (compact) {
    return (
      <div className="print:hidden inline-flex flex-wrap items-center gap-1.5">
        <Tooltip content="Print or save as PDF (browser dialog). Includes regulatory disclaimer.">
          <button
            type="button"
            onClick={onPrint}
            className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
          >
            Print / PDF
          </button>
        </Tooltip>
        <Tooltip content="Download structured tech-transfer pack (JSON) for folders / review">
          <button
            type="button"
            onClick={onTechTransferJson}
            className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
          >
            Tech-transfer JSON
          </button>
        </Tooltip>
        <Tooltip content="BOM + steps + equipment rows for MES/LIMS import experiments">
          <button
            type="button"
            onClick={onMesLimsJson}
            className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
          >
            MES/LIMS JSON
          </button>
        </Tooltip>
        <Tooltip content="Sourced-only process atoms + open gaps (no invented plant numbers)">
          <button
            type="button"
            onClick={onPublicProcessBrief}
            className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-100 hover:bg-teal-500/15"
          >
            Public process brief
          </button>
        </Tooltip>
        <Tooltip content="Operator shift-brief JSON: sequence, EHS, site-fill checklist">
          <button
            type="button"
            onClick={onOperatorJobAid}
            className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
          >
            Operator job aid
          </button>
        </Tooltip>
        <Tooltip content="Single agent-pack JSON: guidance, process-knowledge, densify-next, vault fingerprint">
          <button
            type="button"
            onClick={onAgentPack}
            className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-100 hover:bg-violet-500/15"
          >
            Agent pack
          </button>
        </Tooltip>
        <Tooltip
          content={`Primary ${workerRole} role-pack JSON (Monday deliverable). Free-public densify only.`}
        >
          <button
            type="button"
            onClick={onRolePack}
            className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-100 hover:bg-sky-500/15"
          >
            Role pack ({workerRole})
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="print:hidden relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
      >
        Export ▾
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              onPrint();
              setOpen(false);
            }}
          >
            Print / PDF
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              onTechTransferJson();
              setOpen(false);
            }}
          >
            Tech-transfer pack (JSON)
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-teal-100 hover:bg-slate-800"
            onClick={() => {
              onPublicProcessBrief();
              setOpen(false);
            }}
          >
            Public process brief (sourced)
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-violet-100 hover:bg-slate-800"
            onClick={() => {
              onAgentPack();
              setOpen(false);
            }}
          >
            Agent pack (densify + knowledge)
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-sky-100 hover:bg-slate-800"
            onClick={() => {
              onRolePack();
              setOpen(false);
            }}
          >
            Role pack · {workerRole}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              onMesLimsJson();
              setOpen(false);
            }}
          >
            MES / LIMS rows (JSON)
          </button>
          <p className="border-t border-slate-800 px-3 py-2 text-[10px] leading-snug text-slate-500">
            Not regulatory decision support. Exports include disclaimer + evidence metadata.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Keep legacy PrintExport name as thin wrapper for simple print. */
export function PrintExport({ label = "Print / PDF" }: { label?: string }) {
  return (
    <Tooltip content="Print or save as PDF via your browser. Hides chrome for a plant-summary layout.">
      <button
        type="button"
        onClick={() => window.print()}
        className="print:hidden rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
      >
        {label}
      </button>
    </Tooltip>
  );
}
