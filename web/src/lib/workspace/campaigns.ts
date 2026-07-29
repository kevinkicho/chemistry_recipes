/**
 * Local multi-CID science campaigns — densify and study a connected set.
 * Browser localStorage only.
 */

const KEY = "cr-science-campaigns-v1";

export interface ScienceCampaign {
  id: string;
  name: string;
  description?: string;
  /** Ordered PubChem CIDs */
  cids: number[];
  /** Optional labels */
  labels: Record<string, string>;
  notes: string[];
  createdAt: string;
  updatedAt: string;
  /** Last batch densify summary */
  lastBatch?: {
    at: string;
    ok: number;
    fail: number;
    detail?: string;
  };
}

function canUse(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function uid(): string {
  return `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readAll(): ScienceCampaign[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as ScienceCampaign[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ScienceCampaign[]): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  window.dispatchEvent(new CustomEvent("cr-campaigns-changed"));
}

export function listCampaigns(): ScienceCampaign[] {
  return readAll().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getCampaign(id: string): ScienceCampaign | null {
  return readAll().find((c) => c.id === id) || null;
}

export function createCampaign(
  name: string,
  cids: number[],
  opts?: { description?: string; labels?: Record<string, string> }
): ScienceCampaign {
  const now = new Date().toISOString();
  const camp: ScienceCampaign = {
    id: uid(),
    name: name.trim() || "Science campaign",
    description: opts?.description,
    cids: [...new Set(cids.filter((c) => c > 0))].slice(0, 40),
    labels: opts?.labels || {},
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([camp, ...readAll()]);
  return camp;
}

export function updateCampaign(
  id: string,
  patch: Partial<
    Pick<ScienceCampaign, "name" | "description" | "cids" | "labels" | "notes" | "lastBatch">
  >
): ScienceCampaign | null {
  const all = readAll();
  const i = all.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const next: ScienceCampaign = {
    ...all[i]!,
    ...patch,
    cids: patch.cids
      ? [...new Set(patch.cids.filter((c) => c > 0))].slice(0, 40)
      : all[i]!.cids,
    updatedAt: new Date().toISOString(),
  };
  all[i] = next;
  writeAll(all);
  return next;
}

export function deleteCampaign(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function addCidToCampaign(
  id: string,
  cid: number,
  label?: string
): ScienceCampaign | null {
  const c = getCampaign(id);
  if (!c || !Number.isFinite(cid) || cid <= 0) return null;
  const cids = [...new Set([...c.cids, cid])].slice(0, 40);
  const labels = { ...c.labels };
  if (label) labels[String(cid)] = label;
  return updateCampaign(id, { cids, labels });
}

export function subscribeCampaigns(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = () => listener();
  window.addEventListener("cr-campaigns-changed", on);
  return () => window.removeEventListener("cr-campaigns-changed", on);
}

/** Session handoff: problem densify → workspace campaign agent */
const HANDOFF_KEY = "cr-campaign-agent-handoff-v1";

export interface CampaignAgentHandoff {
  campaignId: string;
  question?: string;
  autoRun: boolean;
  problemQuery?: string;
  at: string;
}

export function setCampaignAgentHandoff(
  handoff: Omit<CampaignAgentHandoff, "at">
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        ...handoff,
        at: new Date().toISOString(),
      } satisfies CampaignAgentHandoff)
    );
  } catch {
    /* ignore quota */
  }
}

/** Read and clear handoff (one-shot). */
export function consumeCampaignAgentHandoff(): CampaignAgentHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    const p = JSON.parse(raw) as CampaignAgentHandoff;
    if (!p?.campaignId) return null;
    return p;
  } catch {
    return null;
  }
}
