"use client";

import { useEffect, useState } from "react";
import {
  WORKER_ROLES,
  readWorkerRole,
  writeWorkerRole,
  subscribeWorkerRole,
  type WorkerRole,
} from "@/lib/worker/roleMode";

/**
 * Role switcher for plant / MSAT / manager views.
 */
export function WorkerRoleBar({
  onChange,
}: {
  onChange?: (role: WorkerRole) => void;
}) {
  const [role, setRole] = useState<WorkerRole>("msat");

  useEffect(() => {
    setRole(readWorkerRole());
    return subscribeWorkerRole((r) => {
      setRole(r);
      onChange?.(r);
    });
  }, [onChange]);

  function select(r: WorkerRole) {
    writeWorkerRole(r);
    setRole(r);
    onChange?.(r);
  }

  const current = WORKER_ROLES.find((x) => x.id === role);

  return (
    <div
      className="print:hidden rounded-xl border border-slate-800 bg-slate-900/60 p-3"
      data-worker-role={role}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Worker view
        </span>
        <div className="flex flex-wrap gap-1.5">
          {WORKER_ROLES.map((r) => {
            const active = r.id === role;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => select(r.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                  active
                    ? "bg-teal-500/20 text-teal-100 ring-teal-400/40"
                    : "bg-slate-950 text-slate-400 ring-slate-700 hover:text-slate-200"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
      {current ? (
        <p className="mt-1.5 text-[11px] text-slate-500">{current.blurb}</p>
      ) : null}
    </div>
  );
}
