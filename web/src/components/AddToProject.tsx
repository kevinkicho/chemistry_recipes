"use client";

import { useEffect, useState } from "react";
import {
  addItemToProject,
  createProject,
  readProjects,
  subscribeProjects,
  type WorkspaceProject,
} from "@/lib/workspace/projects";
import { Tooltip } from "@/components/Tooltip";

export function AddToProject({
  kind,
  refId,
  label,
  href,
  cas,
  modality,
}: {
  kind: "live-cid" | "example";
  refId: string;
  label: string;
  href: string;
  cas?: string;
  modality?: string;
}) {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setProjects(readProjects());
    return subscribeProjects(() => setProjects(readProjects()));
  }, []);

  function refresh() {
    setProjects(readProjects());
  }

  function addTo(projectId: string) {
    const ok = addItemToProject(projectId, {
      kind,
      ref: refId,
      label,
      href,
      cas,
      modality,
    });
    setMsg(ok ? "Added to project" : "Already in that project");
    refresh();
    setTimeout(() => setMsg(null), 2500);
  }

  function newAndAdd() {
    const name = window.prompt("Project name", "Tech transfer");
    if (!name?.trim()) return;
    const p = createProject(name.trim());
    addTo(p.id);
    setOpen(false);
  }

  return (
    <div className="print:hidden relative inline-block">
      <Tooltip content="Pin this recipe to a local project (browser only)">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
        >
          + Project
        </button>
      </Tooltip>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No projects yet</p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  addTo(p.id);
                  setOpen(false);
                }}
              >
                {p.name}
                <span className="ml-1 text-slate-600">({p.items.length})</span>
              </button>
            ))
          )}
          <button
            type="button"
            className="block w-full border-t border-slate-800 px-3 py-2 text-left text-xs font-medium text-teal-300 hover:bg-slate-800"
            onClick={newAndAdd}
          >
            + New project…
          </button>
        </div>
      ) : null}
      {msg ? (
        <span className="ml-2 text-[11px] text-teal-400/90" role="status">
          {msg}
        </span>
      ) : null}
    </div>
  );
}
