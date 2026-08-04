/**
 * Worker role modes — reshape the live dossier for actual plant roles.
 * Stored in localStorage only (local-first).
 */

export type WorkerRole = "operator" | "chemist" | "msat" | "manager";

const KEY = "cr-worker-role-v1";

export const WORKER_ROLES: Array<{
  id: WorkerRole;
  label: string;
  blurb: string;
}> = [
  {
    id: "operator",
    label: "Operator",
    blurb: "EHS · job aid steps · site gaps — floor-first",
  },
  {
    id: "chemist",
    label: "Process chemist",
    blurb: "BOM · unit ops · conditions · literature / patents",
  },
  {
    id: "msat",
    label: "MSAT / tech transfer",
    blurb: "Checklist · export · readiness · site-fill",
  },
  {
    id: "manager",
    label: "Manager",
    blurb: "One-page brief · risks · not-GMP framing",
  },
];

/** Default role for first visit: MSAT Monday path (progressive disclosure). */
export const DEFAULT_WORKER_ROLE: WorkerRole = "msat";

export function readWorkerRole(): WorkerRole {
  if (typeof window === "undefined") return DEFAULT_WORKER_ROLE;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "operator" || v === "chemist" || v === "msat" || v === "manager") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WORKER_ROLE;
}

export function writeWorkerRole(role: WorkerRole): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, role);
    window.dispatchEvent(new CustomEvent("cr-worker-role-changed", { detail: role }));
  } catch {
    /* ignore */
  }
}

export function subscribeWorkerRole(listener: (role: WorkerRole) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = () => listener(readWorkerRole());
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<WorkerRole>).detail;
    if (d) listener(d);
    else on();
  };
  window.addEventListener("cr-worker-role-changed", onCustom);
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === KEY) on();
  });
  return () => {
    window.removeEventListener("cr-worker-role-changed", onCustom);
  };
}

/** Which dossier sections show for each role */
export type DossierSectionId =
  | "monday-pack"
  | "framing"
  | "readiness"
  | "critical-params"
  | "parameters"
  | "routes"
  | "route-compare"
  | "related"
  | "unit-ops"
  | "manager-brief"
  | "operator-aid"
  | "process-facts"
  | "local-enrich"
  | "site-fill"
  | "checklist"
  | "score-coverage"
  | "multi-source"
  | "lit-patents-mfg"
  | "aside-full"
  | "work-pack";

const ALL: DossierSectionId[] = [
  "monday-pack",
  "framing",
  "readiness",
  "critical-params",
  "parameters",
  "routes",
  "route-compare",
  "related",
  "unit-ops",
  "manager-brief",
  "operator-aid",
  "process-facts",
  "local-enrich",
  "site-fill",
  "checklist",
  "score-coverage",
  "multi-source",
  "lit-patents-mfg",
  "aside-full",
  "work-pack",
];

const ROLE_SECTIONS: Record<WorkerRole, DossierSectionId[]> = {
  /** Floor-first: one-scroll path — pack, job aid, site blanks, shift pack */
  operator: [
    "monday-pack",
    "operator-aid",
    "site-fill",
    "work-pack",
    "local-enrich",
  ],
  chemist: [
    "monday-pack",
    "framing",
    "readiness",
    "critical-params",
    "routes",
    "route-compare",
    "related",
    "unit-ops",
    "process-facts",
    "local-enrich",
    "lit-patents-mfg",
    "multi-source",
    "aside-full",
    "work-pack",
  ],
  msat: [
    "monday-pack",
    "framing",
    "readiness",
    "routes",
    "checklist",
    "site-fill",
    "local-enrich",
    "manager-brief",
    "operator-aid",
    "score-coverage",
    "process-facts",
    "parameters",
    "lit-patents-mfg",
    "work-pack",
    "aside-full",
  ],
  manager: [
    "monday-pack",
    "framing",
    "readiness",
    "manager-brief",
    "checklist",
    "score-coverage",
    "work-pack",
  ],
};

export function sectionVisible(role: WorkerRole, id: DossierSectionId): boolean {
  return (ROLE_SECTIONS[role] || ALL).includes(id);
}
