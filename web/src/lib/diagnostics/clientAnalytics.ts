/**
 * Browser-side analytics for diagnostics (IndexedDB + localStorage).
 * No secrets; all data stays on-device.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import {
  formatCacheAge,
  listCachedDossiers,
  getCachedDossier,
  probeIdbHealth,
  type IdbHealthReport,
} from "@/lib/idb/dossierCache";
import { listDossierSnapshots } from "@/lib/idb/dossierSnapshots";
import { readProjects } from "@/lib/workspace/projects";
import { readAiConfig, isAiConfigured } from "@/lib/ai/config";
import { readHistory } from "@/lib/search-history";

export interface ApiTraceStat {
  host: string;
  total: number;
  ok: number;
  fail: number;
}

export interface CachedDossierStat {
  cid: number;
  name?: string;
  savedAt: number;
  age: string;
  buildMode?: string;
  evidenceScore?: number;
  confidence?: string;
  literatureCount: number;
  patentCount: number;
  annotationSources: string[];
  apiOk: number;
  apiFail: number;
  modality?: string;
  model?: string;
}

export interface ClientAnalytics {
  generatedAt: string;
  browser: {
    indexedDb: boolean;
    localStorage: boolean;
  };
  /** Open / read / write probe + schema counts */
  idbHealth: IdbHealthReport | null;
  aiBrowser: {
    enabled: boolean;
    configured: boolean;
    provider: string;
    model: string;
    fastModel: string;
    hasLocalKey: boolean;
    host: string;
  };
  history: {
    entries: number;
    recent: Array<{ label: string; kind: string; ts: number }>;
  };
  workspace: {
    projects: number;
    pinnedItems: number;
  };
  cache: {
    dossierCount: number;
    dossiers: CachedDossierStat[];
    snapshotSamples: number;
  };
  aggregates: {
    avgEvidenceScore: number | null;
    buildModes: Record<string, number>;
    annotationSourceCounts: Record<string, number>;
    apiHosts: ApiTraceStat[];
  };
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40) || "unknown";
  }
}

function analyzeDossier(d: LiveDossier, savedAt: number): CachedDossierStat {
  const hosts = new Map<string, { ok: number; fail: number }>();
  for (const t of d.traces || []) {
    const h = hostFromUrl(t.endpointUrl);
    const cur = hosts.get(h) || { ok: 0, fail: 0 };
    if (t.ok) cur.ok += 1;
    else cur.fail += 1;
    hosts.set(h, cur);
  }
  let apiOk = 0;
  let apiFail = 0;
  for (const v of hosts.values()) {
    apiOk += v.ok;
    apiFail += v.fail;
  }

  return {
    cid: d.cid,
    name: d.identity?.name,
    savedAt,
    age: formatCacheAge(savedAt),
    buildMode: d.buildMode,
    evidenceScore: d.evidenceScore?.score,
    confidence: d.evidenceScore?.confidence || d.synthesis?.confidence,
    literatureCount: d.literature?.length ?? 0,
    patentCount: d.patents?.length ?? 0,
    annotationSources: [
      ...new Set((d.annotations || []).map((a) => a.source)),
    ],
    apiOk,
    apiFail,
    modality: d.modality,
    model: d.synthesis?.model || d.buildAudit?.model,
  };
}

export async function collectClientAnalytics(): Promise<ClientAnalytics> {
  const indexedDb =
    typeof window !== "undefined" && typeof indexedDB !== "undefined";
  const localStorageOk =
    typeof window !== "undefined" && typeof localStorage !== "undefined";

  const ai = readAiConfig();
  const history = readHistory();
  const projects = readProjects();

  let idbHealth: IdbHealthReport | null = null;
  try {
    idbHealth = await probeIdbHealth();
  } catch {
    idbHealth = null;
  }

  const list = await listCachedDossiers();
  const dossiers: CachedDossierStat[] = [];
  const buildModes: Record<string, number> = {};
  const annotationSourceCounts: Record<string, number> = {};
  const hostMap = new Map<string, { ok: number; fail: number; total: number }>();
  let scoreSum = 0;
  let scoreN = 0;
  let snapshotSamples = 0;

  for (const row of list.slice(0, 40)) {
    const full = await getCachedDossier(row.cid);
    if (!full?.dossier) continue;
    const stat = analyzeDossier(full.dossier, full.savedAt);
    dossiers.push(stat);

    const mode = stat.buildMode || "unknown";
    buildModes[mode] = (buildModes[mode] || 0) + 1;

    if (typeof stat.evidenceScore === "number") {
      scoreSum += stat.evidenceScore;
      scoreN += 1;
    }
    for (const s of stat.annotationSources) {
      annotationSourceCounts[s] = (annotationSourceCounts[s] || 0) + 1;
    }

    for (const t of full.dossier.traces || []) {
      const h = hostFromUrl(t.endpointUrl);
      const cur = hostMap.get(h) || { ok: 0, fail: 0, total: 0 };
      cur.total += 1;
      if (t.ok) cur.ok += 1;
      else cur.fail += 1;
      hostMap.set(h, cur);
    }

    try {
      const snaps = await listDossierSnapshots(row.cid);
      snapshotSamples += snaps.length;
    } catch {
      /* ignore */
    }
  }

  const apiHosts: ApiTraceStat[] = [...hostMap.entries()]
    .map(([host, v]) => ({
      host,
      total: v.total,
      ok: v.ok,
      fail: v.fail,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    browser: {
      indexedDb,
      localStorage: localStorageOk,
    },
    idbHealth,
    aiBrowser: {
      enabled: ai.enabled,
      configured: isAiConfigured(ai),
      provider: ai.provider,
      model: ai.model,
      fastModel: ai.fastModel,
      hasLocalKey: Boolean(ai.apiKey.trim()),
      host: ai.host,
    },
    history: {
      entries: history.length,
      recent: history.slice(0, 8).map((h) => ({
        label: h.label,
        kind: h.kind,
        ts: h.ts,
      })),
    },
    workspace: {
      projects: projects.length,
      pinnedItems: projects.reduce((n, p) => n + p.items.length, 0),
    },
    cache: {
      dossierCount: list.length,
      dossiers: dossiers.slice(0, 15),
      snapshotSamples,
    },
    aggregates: {
      avgEvidenceScore: scoreN ? Math.round(scoreSum / scoreN) : null,
      buildModes,
      annotationSourceCounts,
      apiHosts,
    },
  };
}

/** Summarize traces from a single live dossier for the page-level strip. */
export function summarizeDossierDiagnostics(dossier: LiveDossier): {
  apiTotal: number;
  apiOk: number;
  apiFail: number;
  hosts: ApiTraceStat[];
  annotationCount: number;
  annotationSources: string[];
  literatureCount: number;
  patentCount: number;
  evidenceScore?: number;
  confidence?: string;
  buildMode?: string;
  model?: string;
  durationMs?: number;
} {
  const hostMap = new Map<string, { ok: number; fail: number; total: number }>();
  for (const t of dossier.traces || []) {
    const h = hostFromUrl(t.endpointUrl);
    const cur = hostMap.get(h) || { ok: 0, fail: 0, total: 0 };
    cur.total += 1;
    if (t.ok) cur.ok += 1;
    else cur.fail += 1;
    hostMap.set(h, cur);
  }
  const hosts = [...hostMap.entries()]
    .map(([host, v]) => ({ host, total: v.total, ok: v.ok, fail: v.fail }))
    .sort((a, b) => b.total - a.total);
  const apiOk = hosts.reduce((n, h) => n + h.ok, 0);
  const apiFail = hosts.reduce((n, h) => n + h.fail, 0);
  return {
    apiTotal: apiOk + apiFail,
    apiOk,
    apiFail,
    hosts,
    annotationCount: dossier.annotations?.length ?? 0,
    annotationSources: [
      ...new Set((dossier.annotations || []).map((a) => a.source)),
    ],
    literatureCount: dossier.literature?.length ?? 0,
    patentCount: dossier.patents?.length ?? 0,
    evidenceScore: dossier.evidenceScore?.score,
    confidence: dossier.evidenceScore?.confidence || dossier.synthesis?.confidence,
    buildMode: dossier.buildMode,
    model: dossier.synthesis?.model || dossier.buildAudit?.model,
    durationMs: dossier.buildAudit?.durationMs,
  };
}
