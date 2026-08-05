/**
 * Local-first project workspace (browser localStorage).
 * Teams can pin recipes / live CIDs without server accounts.
 */

export interface ProjectItem {
  id: string;
  /** Live PubChem CID only; "example" kept for legacy localStorage only */
  kind: "live-cid" | "example";
  /** PubChem CID string */
  ref: string;
  label: string;
  href: string;
  notes?: string;
  addedAt: string;
  modality?: string;
  cas?: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  items: ProjectItem[];
}

const STORAGE_KEY = "cr-workspace-projects-v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function uid(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readProjects(): WorkspaceProject[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProjects(projects: WorkspaceProject[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  window.dispatchEvent(new CustomEvent("cr-workspace-changed"));
}

export function subscribeProjects(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = () => listener();
  window.addEventListener("cr-workspace-changed", on);
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === STORAGE_KEY) on();
  });
  return () => {
    window.removeEventListener("cr-workspace-changed", on);
  };
}

export function createProject(name: string, description?: string): WorkspaceProject {
  const now = new Date().toISOString();
  const project: WorkspaceProject = {
    id: uid(),
    name: name.trim() || "Untitled project",
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    items: [],
  };
  const all = readProjects();
  all.unshift(project);
  writeProjects(all);
  return project;
}

export function renameProject(id: string, name: string): void {
  const all = readProjects();
  const p = all.find((x) => x.id === id);
  if (!p) return;
  p.name = name.trim() || p.name;
  p.updatedAt = new Date().toISOString();
  writeProjects(all);
}

export function deleteProject(id: string): void {
  writeProjects(readProjects().filter((p) => p.id !== id));
}

export function addItemToProject(
  projectId: string,
  item: Omit<ProjectItem, "id" | "addedAt">
): boolean {
  const all = readProjects();
  const p = all.find((x) => x.id === projectId);
  if (!p) return false;
  const exists = p.items.some((i) => i.kind === item.kind && i.ref === item.ref);
  if (exists) return false;
  p.items.unshift({
    ...item,
    id: uid(),
    addedAt: new Date().toISOString(),
  });
  p.updatedAt = new Date().toISOString();
  writeProjects(all);
  return true;
}

export function removeItemFromProject(projectId: string, itemId: string): void {
  const all = readProjects();
  const p = all.find((x) => x.id === projectId);
  if (!p) return;
  p.items = p.items.filter((i) => i.id !== itemId);
  p.updatedAt = new Date().toISOString();
  writeProjects(all);
}

export function updateItemNotes(
  projectId: string,
  itemId: string,
  notes: string
): void {
  const all = readProjects();
  const p = all.find((x) => x.id === projectId);
  if (!p) return;
  const item = p.items.find((i) => i.id === itemId);
  if (!item) return;
  item.notes = notes.trim() || undefined;
  p.updatedAt = new Date().toISOString();
  writeProjects(all);
}

export function getProject(id: string): WorkspaceProject | undefined {
  return readProjects().find((p) => p.id === id);
}

/** Import a project from exported JSON (or raw project object). */
export function importProject(raw: unknown): { ok: true; project: WorkspaceProject } | { ok: false; error: string } {
  try {
    let data = raw;
    if (typeof raw === "string") data = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      return { ok: false, error: "Invalid JSON" };
    }
    const o = data as Record<string, unknown>;
    const proj =
      o.project && typeof o.project === "object"
        ? (o.project as Record<string, unknown>)
        : o;

    const name = typeof proj.name === "string" ? proj.name.trim() : "";
    if (!name) return { ok: false, error: "Project name missing" };

    const itemsIn = Array.isArray(proj.items) ? proj.items : [];
    const items: ProjectItem[] = [];
    for (const it of itemsIn) {
      if (!it || typeof it !== "object") continue;
      const i = it as Record<string, unknown>;
      const kind = i.kind === "example" ? "example" : i.kind === "live-cid" ? "live-cid" : null;
      const ref = typeof i.ref === "string" ? i.ref.trim() : "";
      const label = typeof i.label === "string" ? i.label.trim() : "";
      const href = typeof i.href === "string" ? i.href.trim() : "";
      if (!kind || !ref || !label || !href) continue;
      items.push({
        id: uid(),
        kind,
        ref,
        label,
        href,
        notes: typeof i.notes === "string" ? i.notes : undefined,
        addedAt:
          typeof i.addedAt === "string" ? i.addedAt : new Date().toISOString(),
        modality: typeof i.modality === "string" ? i.modality : undefined,
        cas: typeof i.cas === "string" ? i.cas : undefined,
      });
    }

    const now = new Date().toISOString();
    const project: WorkspaceProject = {
      id: uid(),
      name: `${name} (imported)`,
      description:
        typeof proj.description === "string" ? proj.description : undefined,
      createdAt: now,
      updatedAt: now,
      items,
    };
    const all = readProjects();
    all.unshift(project);
    writeProjects(all);
    return { ok: true, project };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import failed",
    };
  }
}
