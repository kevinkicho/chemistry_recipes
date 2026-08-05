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
 * Primary exports: Print, Role pack, Agent pack.
 * Secondary (More): tech-transfer, brief, job aid, MES/LIMS.
 * Live densify dossiers only.
 */
export function TechTransferExport({
  source,
  compact = false,
}: {
  source: { kind: "live"; dossier: LiveDossier };
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [workerRole, setWorkerRole] = useState<WorkerRole>("chemist");

  useEffect(() => {
    setWorkerRole(readWorkerRole());
    return subscribeWorkerRole(setWorkerRole);
  }, []);

  function pack() {
    return buildTechTransferFromLive(source.dossier);
  }

  function nameBase() {
    return slugifyName(pack().entity.name || "entity");
  }

  function onPrint() {
    window.print();
  }

  function onTechTransferJson() {
    downloadJson(`${nameBase()}-tech-transfer-v2.json`, pack());
  }

  function onMesLimsJson() {
    downloadJson(
      `${nameBase()}-mes-lims.json`,
      buildMesLimsFromTechTransfer(pack())
    );
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
    downloadJson(
      `${nameBase()}-agent-pack-v1.json`,
      buildAgentPack(source.dossier)
    );
  }

  function onRolePack() {
    downloadJson(
      `${nameBase()}-role-pack-${workerRole}-v1.json`,
      buildRolePack(source.dossier, workerRole)
    );
  }

  const primary = (
    <>
      <Tooltip content="Print or save as PDF. Includes regulatory disclaimer.">
        <button
          type="button"
          onClick={onPrint}
          className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
        >
          Print / PDF
        </button>
      </Tooltip>
      <Tooltip
        content={`Primary ${workerRole} role-pack (Monday deliverable). Live densify only.`}
      >
        <button
          type="button"
          onClick={onRolePack}
          className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-100 hover:bg-sky-500/15"
        >
          Role pack ({workerRole})
        </button>
      </Tooltip>
      <Tooltip content="Agent-pack JSON: guidance, densify-next, vault fingerprint for notebooks">
        <button
          type="button"
          onClick={onAgentPack}
          className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-100 hover:bg-violet-500/15"
        >
          Agent pack
        </button>
      </Tooltip>
    </>
  );

  const secondary = (
    <>
      <button
        type="button"
        onClick={onTechTransferJson}
        className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
      >
        Tech-transfer JSON
      </button>
      <button
        type="button"
        onClick={onPublicProcessBrief}
        className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
      >
        Process brief
      </button>
      <button
        type="button"
        onClick={onOperatorJobAid}
        className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
      >
        Job aid JSON
      </button>
      <button
        type="button"
        onClick={onMesLimsJson}
        className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
      >
        MES/LIMS JSON
      </button>
    </>
  );

  if (compact) {
    return (
      <div className="print:hidden inline-flex flex-wrap items-center gap-1.5">
        {primary}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="rounded-md border border-slate-800 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300"
        >
          {more ? "Less" : "More…"}
        </button>
        {more ? secondary : null}
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
            className="block w-full px-3 py-2 text-left text-xs text-violet-100 hover:bg-slate-800"
            onClick={() => {
              onAgentPack();
              setOpen(false);
            }}
          >
            Agent pack
          </button>
          <p className="border-t border-slate-800 px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-600">
            More
          </p>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-800"
            onClick={() => {
              onTechTransferJson();
              setOpen(false);
            }}
          >
            Tech-transfer JSON
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-800"
            onClick={() => {
              onPublicProcessBrief();
              setOpen(false);
            }}
          >
            Process brief
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-800"
            onClick={() => {
              onOperatorJobAid();
              setOpen(false);
            }}
          >
            Job aid JSON
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-800"
            onClick={() => {
              onMesLimsJson();
              setOpen(false);
            }}
          >
            MES/LIMS JSON
          </button>
          <p className="border-t border-slate-800 px-3 py-2 text-[10px] leading-snug text-slate-500">
            Live densify only. Not GMP / not regulatory decision support.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function PrintExport({ label = "Print / PDF" }: { label?: string }) {
  return (
    <Tooltip content="Print or save as PDF via your browser.">
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
