"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  createProject,
  deleteProject,
  importProject,
  readProjects,
  removeItemFromProject,
  renameProject,
  subscribeProjects,
  updateItemNotes,
  type WorkspaceProject,
} from "@/lib/workspace/projects";
import { routes } from "@/lib/routes";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { downloadJson, slugifyName } from "@/lib/export/techTransfer";
import { BatchDensifyPanel } from "@/components/frontier/BatchDensifyPanel";
import { CampaignGraphPanel } from "@/components/frontier/CampaignGraphPanel";
import { CampaignAgentPanel } from "@/components/frontier/CampaignAgentPanel";
import { CampaignBriefPanel } from "@/components/frontier/CampaignBriefPanel";
import { CampaignComparePanel } from "@/components/frontier/CampaignComparePanel";
import { WorkspaceScienceIndexPanel } from "@/components/frontier/WorkspaceScienceIndexPanel";
import { DensifyTelemetryPanel } from "@/components/frontier/DensifyTelemetryPanel";
import {
  listCampaigns,
  deleteCampaign,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";

export default function WorkspacePage() {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);

  useEffect(() => {
    const load = () => {
      const all = readProjects();
      setProjects(all);
      setSelectedId((prev) => prev || all[0]?.id || null);
    };
    load();
    return subscribeProjects(load);
  }, []);

  useEffect(() => {
    const load = () => setCampaigns(listCampaigns());
    load();
    return subscribeCampaigns(load);
  }, []);

  const selected = projects.find((p) => p.id === selectedId) || null;

  const compareItems = useMemo(() => {
    if (!selected) return null;
    const a = selected.items.find((i) => i.id === compareA);
    const b = selected.items.find((i) => i.id === compareB);
    if (!a || !b) return null;
    return { a, b };
  }, [selected, compareA, compareB]);

  function onCreate() {
    const name = window.prompt("Project name", "New project");
    if (!name?.trim()) return;
    const p = createProject(name.trim());
    setSelectedId(p.id);
  }

  function onRename() {
    if (!selected) return;
    const name = window.prompt("Rename project", selected.name);
    if (!name?.trim()) return;
    renameProject(selected.id, name.trim());
  }

  function onDelete() {
    if (!selected) return;
    if (!confirm(`Delete project “${selected.name}”?`)) return;
    deleteProject(selected.id);
    setSelectedId(null);
  }

  function onExportProject() {
    if (!selected) return;
    downloadJson(`project-${slugifyName(selected.name)}.json`, {
      schema: "chemistry-recipes.workspace-project.v1",
      exportedAt: new Date().toISOString(),
      regulatoryNotice:
        "NOT FOR REGULATORY DECISION SUPPORT. Local workspace export only.",
      project: selected,
    });
  }

  function onImportProject() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = importProject(text);
        if (!result.ok) {
          alert(result.error);
          return;
        }
        setSelectedId(result.project.id);
      } catch {
        alert("Could not read file");
      }
    };
    input.click();
  }

  function startEditNotes(itemId: string, current?: string) {
    setEditingNotes(itemId);
    setNoteDraft(current || "");
  }

  function saveNotes(itemId: string) {
    if (!selected) return;
    updateItemNotes(selected.id, itemId, noteDraft);
    setEditingNotes(null);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Workspace
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Local-first project library for process teams. Pin{" "}
        <strong className="font-medium text-slate-300">live</strong> dossiers from Search,
        add tech-transfer notes, export project JSON, and compare two pins. (Optional demo
        pins from{" "}
        <Link href={routes.info()} className="text-amber-300/90 hover:underline">
          Info
        </Link>{" "}
        stay labeled as for-show.) Data stays in this browser (localStorage).
      </p>
      <div className="mt-4">
        <RegulatoryDisclaimer compact />
      </div>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">
          Science index · densify home
        </h2>
        <p className="text-xs text-slate-500">
          Cross-campaign inventory and thin CID queue first — densify here before diving into
          project pins. Local-first; free-public only.
        </p>
        <WorkspaceScienceIndexPanel />
        <DensifyTelemetryPanel />
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">
          Science campaigns (multi-CID)
        </h2>
        <p className="text-xs text-slate-500">
          Campaigns are local CID sets for batch densify and network study — create them from
          a live dossier&apos;s reaction network panel.
        </p>
        {campaigns.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-100">{c.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {c.cids.join(", ")}
                    </div>
                    {c.lastBatch ? (
                      <div className="mt-1 text-[10px] text-slate-600">
                        Last batch: {c.lastBatch.ok} ok / {c.lastBatch.fail} fail
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete campaign “${c.name}”?`)) deleteCampaign(c.id);
                    }}
                    className="text-[11px] text-rose-300/90 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-600">
            No campaigns yet — open a live dossier (chemist role) → Process reaction network →
            Save as science campaign.
          </p>
        )}
        <CampaignGraphPanel />
        <CampaignComparePanel />
        <Suspense
          fallback={
            <div className="rounded-xl border border-indigo-500/20 px-3 py-2 text-[11px] text-slate-500">
              Loading campaign brief…
            </div>
          }
        >
          <CampaignBriefPanel />
        </Suspense>
        <Suspense
          fallback={
            <div className="rounded-xl border border-violet-500/20 px-3 py-2 text-[11px] text-slate-500">
              Loading campaign agent…
            </div>
          }
        >
          <CampaignAgentPanel />
        </Suspense>
        <BatchDensifyPanel />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-2">
          <button
            type="button"
            onClick={onCreate}
            className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            + New project
          </button>
          <button
            type="button"
            onClick={onImportProject}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
          >
            Import JSON…
          </button>
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    setCompareA(null);
                    setCompareB(null);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    p.id === selectedId
                      ? "bg-teal-500/15 text-teal-100 ring-1 ring-teal-500/30"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.items.length} item{p.items.length === 1 ? "" : "s"}
                  </div>
                </button>
              </li>
            ))}
            {projects.length === 0 ? (
              <li className="px-2 py-4 text-xs text-slate-500">
                No projects yet. Create one, then use <strong>+ Project</strong> on any
                dossier.
              </li>
            ) : null}
          </ul>
        </aside>

        <section className="min-w-0">
          {!selected ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-sm text-slate-500">
              Select or create a project. Use{" "}
              <Link href={routes.search()} className="text-teal-400 hover:underline">
                live Search
              </Link>{" "}
              to pin real dossiers. Optional teaching demos are under{" "}
              <Link href={routes.info()} className="text-amber-300/90 hover:underline">
                Info
              </Link>
              .
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">{selected.name}</h2>
                  {selected.description ? (
                    <p className="mt-1 text-sm text-slate-500">{selected.description}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-600">
                    Updated {new Date(selected.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onExportProject}
                    className="rounded-md border border-teal-500/30 px-2.5 py-1 text-xs text-teal-200 hover:bg-teal-500/10"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={onRename}
                    className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-900"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded-md border border-rose-500/30 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {selected.items.length >= 2 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Compare two pins
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <select
                      value={compareA || ""}
                      onChange={(e) => setCompareA(e.target.value || null)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">Pin A…</option>
                      {selected.items.map((i) => (
                        <option key={`a-${i.id}`} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={compareB || ""}
                      onChange={(e) => setCompareB(e.target.value || null)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">Pin B…</option>
                      {selected.items.map((i) => (
                        <option key={`b-${i.id}`} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {compareItems ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[compareItems.a, compareItems.b].map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400"
                        >
                          <Link
                            href={item.href}
                            className="text-sm font-medium text-teal-300 hover:underline"
                          >
                            {item.label}
                          </Link>
                          <div className="mt-1 space-y-0.5">
                            <div>Kind: {item.kind}</div>
                            <div>Ref: {item.ref}</div>
                            {item.cas ? <div>CAS: {item.cas}</div> : null}
                            {item.modality ? <div>Modality: {item.modality}</div> : null}
                            {item.notes ? (
                              <div className="mt-1 text-slate-500">{item.notes}</div>
                            ) : (
                              <div className="mt-1 text-slate-600">No notes</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selected.items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Empty project. Open a compound or example and click{" "}
                  <strong className="text-slate-400">+ Project</strong>.
                </p>
              ) : (
                <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                  {selected.items.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={item.href}
                            className="font-medium text-slate-100 hover:text-teal-300"
                          >
                            {item.label}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5">
                              {item.kind === "live-cid" ? "Live CID" : "Example"}
                            </span>
                            {item.cas ? <span>CAS {item.cas}</span> : null}
                            {item.modality ? <span>{item.modality}</span> : null}
                            <span>ref {item.ref}</span>
                          </div>
                          {editingNotes === item.id ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                                placeholder="Tech-transfer notes for this pin…"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveNotes(item.id)}
                                  className="rounded bg-teal-600 px-2 py-1 text-[11px] font-semibold text-white"
                                >
                                  Save notes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNotes(null)}
                                  className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : item.notes ? (
                            <p className="mt-1 text-xs text-slate-400">{item.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => startEditNotes(item.id, item.notes)}
                            className="text-xs text-slate-500 hover:text-teal-300"
                          >
                            {item.notes ? "Edit notes" : "Add notes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItemFromProject(selected.id, item.id)}
                            className="text-xs text-slate-500 hover:text-rose-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
