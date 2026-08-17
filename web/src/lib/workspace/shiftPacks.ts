/**
 * Local shift packs — one printable/JSON artifact for floor handoff.
 * Browser localStorage only. Not a batch record.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import { getSiteFill } from "@/lib/idb/siteFill";
import { getWorkPackForCid } from "@/lib/workspace/workPacks";
import { getUserSupplementsForCid } from "@/lib/idb/userSupplements";
import { honestShiftPackContent } from "@/lib/dossier/sectionHonesty";

const KEY = "cr-shift-packs-v1";

export interface ShiftPackSnapshot {
  id: string;
  schema: "chemistry-recipes.shift-pack.v1";
  cid: number;
  label: string;
  savedAt: string;
  /** Not GMP disclaimer always present */
  disclaimer: string;
  evidenceScore?: number;
  productMode?: string;
  framing?: string;
  ehs: string[];
  preferredRouteName?: string;
  steps: Array<{ order: number; title: string; body: string }>;
  gaps: string[];
  processFactClaims: string[];
  siteFill: Record<string, string>;
  workNotes: string[];
  pasteCount: number;
  litCount: number;
  patentCount: number;
  /** Harvest failure is not a clean 0-step / 0/0 pack. */
  harvestFail?: boolean;
  aiModel?: string | null;
  accuracyNote: string;
}

function canUse(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function uid(): string {
  return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readAll(): ShiftPackSnapshot[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as ShiftPackSnapshot[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ShiftPackSnapshot[]): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  window.dispatchEvent(new CustomEvent("cr-shift-packs-changed"));
}

export function listShiftPacksForCid(cid: number): ShiftPackSnapshot[] {
  return readAll().filter((r) => r.cid === cid);
}

export function listAllShiftPacks(): ShiftPackSnapshot[] {
  return readAll();
}

/** Build a shift pack from the current live dossier + local site/work state. */
export function buildShiftPackFromDossier(dossier: LiveDossier): ShiftPackSnapshot {
  const name = dossier.identity?.name || `CID ${dossier.cid}`;
  const route =
    dossier.processRoutes.find((r) => r.preference === 1) || dossier.processRoutes[0];
  const ehs = [
    ...(dossier.synthesis.ehsHighlights || []),
    ...(dossier.hazards.hazardStatements || []).slice(0, 4),
  ].slice(0, 6);

  const site = getSiteFill(dossier.cid);
  const siteFill: Record<string, string> = {};
  if (site) {
    for (const [k, v] of Object.entries(site)) {
      if (k === "cid" || k === "updatedAt") continue;
      if (typeof v === "string" && v.trim()) siteFill[k] = v.trim();
    }
  }

  const pack = getWorkPackForCid(dossier.cid);
  const pastes = getUserSupplementsForCid(dossier.cid);

  const gaps = [
    ...(dossier.recipeReadiness?.gaps || [])
      .filter((g) => g.severity === "blocker" || g.severity === "major")
      .map((g) => g.label),
    ...(dossier.processFacts?.openGaps || []).slice(0, 6),
  ].slice(0, 10);

  const facts = (dossier.processFacts?.facts || [])
    .filter((f) => f.kind !== "open-gap")
    .slice(0, 20)
    .map((f) => f.claim);

  const honest = honestShiftPackContent({
    traces: dossier.traces,
    fetchErrors: dossier.fetchErrors || [],
    steps: route?.steps || [],
    gaps,
    litCount: dossier.literature?.length ?? 0,
    patentCount: dossier.patents?.length ?? 0,
  });

  return {
    id: uid(),
    schema: "chemistry-recipes.shift-pack.v1",
    cid: dossier.cid,
    label: name,
    savedAt: new Date().toISOString(),
    disclaimer:
      "Educational public-evidence shift pack only. Not a GMP batch record, SOP, or regulatory filing. Validate under site QMS.",
    evidenceScore: dossier.evidenceScore?.score,
    productMode: dossier.productMode || dossier.recipeReadiness?.mode,
    framing: dossier.processFraming,
    ehs,
    preferredRouteName: route?.name,
    steps: honest.steps,
    gaps: honest.gaps,
    processFactClaims: facts,
    siteFill,
    workNotes: (pack?.notes || []).slice(0, 10).map((n) => n.text),
    pasteCount: pastes.length,
    litCount: dossier.literature?.length ?? 0,
    patentCount: dossier.patents?.length ?? 0,
    harvestFail: honest.harvestFail,
    aiModel: dossier.synthesis.parsed ? dossier.synthesis.model || null : null,
    accuracyNote: honest.harvestFail
      ? honest.saveDetail
      : dossier.processFacts?.metrics?.accuracyScore != null
        ? `Process-fact accuracy ${dossier.processFacts.metrics.accuracyScore}/100 · sourced conditions only`
        : "Accuracy layer not scored on this capture",
  };
}

/** Save-status line: harvest failure is not a clean N-step win. */
export function shiftPackSaveDetail(pack: ShiftPackSnapshot): string {
  if (pack.harvestFail && pack.steps.length === 0) {
    return pack.accuracyNote || pack.gaps[0] || "Sources failed — not empty";
  }
  return pack.steps.length + " steps";
}

function litPatentManifestLine(pack: ShiftPackSnapshot): string {
  if ((pack.litCount || 0) + (pack.patentCount || 0) > 0) {
    return pack.litCount + "/" + pack.patentCount;
  }
  if (pack.harvestFail) return "harvest failed — not 0/0";
  return pack.litCount + "/" + pack.patentCount;
}

export function saveShiftPack(pack: ShiftPackSnapshot): ShiftPackSnapshot {
  const all = readAll().filter((r) => r.id !== pack.id);
  all.unshift(pack);
  writeAll(all);
  return pack;
}

export function deleteShiftPack(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function downloadShiftPackJson(pack: ShiftPackSnapshot): void {
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shift-pack-${pack.cid}-${pack.savedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function shiftPackManifestText(pack: ShiftPackSnapshot): string {
  return [
    `Chemistry Recipes · Shift pack v1`,
    pack.disclaimer,
    ``,
    `Compound: ${pack.label}`,
    `CID: ${pack.cid}`,
    `Saved: ${pack.savedAt}`,
    `Evidence: ${pack.evidenceScore ?? "—"}/100 · mode ${pack.productMode || "—"}`,
    `Route: ${pack.preferredRouteName || "—"}`,
    `Steps: ${pack.harvestFail && pack.steps.length === 0 ? "harvest failed — not a clean 0-step pack" : pack.steps.length} · Gaps: ${pack.gaps.length}`,
    `EHS: ${pack.ehs.join(" | ") || "—"}`,
    `Lit/patents: ${litPatentManifestLine(pack)} · pastes ${pack.pasteCount}`,
    pack.accuracyNote,
    ``,
    ...pack.steps.map((s) => `${s.order}. ${s.title}`),
    ``,
    "Gaps:",
    ...pack.gaps.map((g) => `- ${g}`),
  ].join("\n");
}
