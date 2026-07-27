/**
 * Local work packs — sticky notes + paste history for a CID / molecule.
 * Browser localStorage only.
 */

const KEY = "cr-work-packs-v1";

export interface WorkPackNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface WorkPackPaste {
  id: string;
  label: string;
  chars: number;
  createdAt: string;
  /** First ~200 chars preview only — full text stays in user supplements */
  preview: string;
}

export interface WorkPack {
  id: string;
  cid: number;
  label: string;
  notes: WorkPackNote[];
  pastes: WorkPackPaste[];
  createdAt: string;
  updatedAt: string;
}

function canUse(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function uid(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readAll(): WorkPack[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as WorkPack[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeAll(packs: WorkPack[]): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(packs));
  window.dispatchEvent(new CustomEvent("cr-work-packs-changed"));
}

export function getWorkPackForCid(cid: number): WorkPack | null {
  return readAll().find((p) => p.cid === cid) || null;
}

export function ensureWorkPack(cid: number, label: string): WorkPack {
  const all = readAll();
  const existing = all.find((p) => p.cid === cid);
  if (existing) return existing;
  const now = new Date().toISOString();
  const pack: WorkPack = {
    id: uid(),
    cid,
    label: label || `CID ${cid}`,
    notes: [],
    pastes: [],
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(pack);
  writeAll(all.slice(0, 80));
  return pack;
}

export function addWorkPackNote(cid: number, text: string, label?: string): WorkPack {
  const pack = ensureWorkPack(cid, label || `CID ${cid}`);
  const t = text.trim();
  if (!t) return pack;
  const all = readAll();
  const i = all.findIndex((p) => p.cid === cid);
  if (i < 0) return pack;
  const note: WorkPackNote = {
    id: uid(),
    text: t.slice(0, 4000),
    createdAt: new Date().toISOString(),
  };
  all[i] = {
    ...all[i]!,
    notes: [note, ...all[i]!.notes].slice(0, 40),
    updatedAt: note.createdAt,
  };
  writeAll(all);
  return all[i]!;
}

export function addWorkPackPaste(
  cid: number,
  opts: { label: string; text: string; moleculeLabel?: string }
): WorkPack {
  const pack = ensureWorkPack(cid, opts.moleculeLabel || `CID ${cid}`);
  const all = readAll();
  const i = all.findIndex((p) => p.cid === cid);
  if (i < 0) return pack;
  const paste: WorkPackPaste = {
    id: uid(),
    label: opts.label.slice(0, 120),
    chars: opts.text.length,
    createdAt: new Date().toISOString(),
    preview: opts.text.slice(0, 200),
  };
  all[i] = {
    ...all[i]!,
    pastes: [paste, ...all[i]!.pastes].slice(0, 30),
    updatedAt: paste.createdAt,
  };
  writeAll(all);
  return all[i]!;
}

export function listWorkPacks(): WorkPack[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function subscribeWorkPacks(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = () => listener();
  window.addEventListener("cr-work-packs-changed", on);
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === KEY) on();
  });
  return () => window.removeEventListener("cr-work-packs-changed", on);
}
