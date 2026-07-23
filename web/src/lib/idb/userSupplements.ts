/**
 * Local-only user paste of public patent/paper text to enrich process facts.
 * Never uploaded; never multi-user.
 */

const KEY = "cr-user-supplements-v1";

export interface UserTextSupplement {
  cid: number;
  label: string;
  text: string;
  savedAt: number;
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): UserTextSupplement[] {
  if (!canStore()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as UserTextSupplement[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(rows: UserTextSupplement[]): void {
  if (!canStore()) return;
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function getUserSupplementsForCid(cid: number): UserTextSupplement[] {
  return readAll()
    .filter((r) => r.cid === cid)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function saveUserSupplement(
  cid: number,
  text: string,
  label?: string
): UserTextSupplement | null {
  const t = text.trim();
  if (!t || t.length < 40 || !Number.isFinite(cid) || cid <= 0) return null;
  const row: UserTextSupplement = {
    cid,
    label: (label || "Public patent / paper paste").slice(0, 120),
    text: t.slice(0, 200_000),
    savedAt: Date.now(),
  };
  const rest = readAll().filter(
    (r) => !(r.cid === cid && r.label === row.label)
  );
  writeAll([row, ...rest]);
  return row;
}

export function clearUserSupplementsForCid(cid: number): void {
  writeAll(readAll().filter((r) => r.cid !== cid));
}
