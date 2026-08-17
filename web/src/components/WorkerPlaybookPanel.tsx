"use client";

/**
 * Worker playbooks — short, role-oriented checklists over public evidence.
 * Scaffolds Monday scout / site fill / densify paths without inventing plant data.
 */

import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import { slimTraces } from "@/lib/api/trace";
import {
  isProcessFactSourceRef,
  isProcessFactTrace,
} from "@/lib/dossier/sectionHonesty";

type Playbook = {
  id: string;
  title: string;
  role: string;
  steps: string[];
};

const PLAYBOOKS: Playbook[] = [
  {
    id: "monday-scout",
    title: "Monday scout (2 min)",
    role: "Any",
    steps: [
      "Open Monday morning pack — scan EHS first",
      "Note preferred public path + open gaps",
      "If score < 55: paste public procedure text (Local enrich)",
      "Print / PDF for shift handoff — still not a batch record",
    ],
  },
  {
    id: "densify-recipe",
    title: "Densify toward recipe-draft",
    role: "Chemist / MSAT",
    steps: [
      "Run Problem / unit-op search for isolation + crystallization",
      "Paste OA patent/paper experimental text locally",
      "Refresh live data so densify + AI re-package evidence",
      "Check Recipe readiness blockers before claiming recipe-draft",
    ],
  },
  {
    id: "site-fill",
    title: "Site blank fill session",
    role: "MSAT / Process eng",
    steps: [
      "Open Site fill — enter equipment IDs and site ranges (local only)",
      "Export site gaps for QMS discussion",
      "Do not paste confidential SOPs into the public enrich box",
      "Use Operator job aid as training scaffold only",
    ],
  },
  {
    id: "ip-lit",
    title: "IP / literature scan",
    role: "IP / Chemist",
    steps: [
      "Open Patents & Literature tables — sort by year / relevance",
      "Open API provenance on interesting rows (real endpoints only)",
      "Capture tensions in Evidence critique — do not resolve IP legally here",
      "Add preferred patent IDs to work pack notes",
    ],
  },
];

export function WorkerPlaybookPanel({
  dossier,
  onScroll,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onScroll?: (id: string) => void;
  onRegenerate?: () => void;
}) {
  // Playbooks are guided paths over process facts. Leftover identity
  // / annotation HTTP is not playbook provenance, and the chip must
  // not live-fetch identity.
  const allTraces = slimTraces(dossier.traces || []);
  const traces = allTraces.filter((tr) =>
    isProcessFactTrace(tr.endpointUrl)
  );
  const sourceRefs = (dossier.sourceRefs || []).filter(isProcessFactSourceRef);

  return (
    <div
      id="worker-playbooks"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Worker playbooks</h2>
        <ContentProvenance
          title="Worker playbooks"
          field="Playbooks"
          traces={traces}
          sourceRefs={sourceRefs}
          ai={dossier.synthesis.provenance}
          showAi={Boolean(dossier.synthesis.provenance)}
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Guided paths over free-public evidence. Educational only — site QMS owns plant
        procedures.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PLAYBOOKS.map((p) => (
          <article
            key={p.id}
            className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <h3 className="text-xs font-semibold text-slate-100">{p.title}</h3>
              <span className="text-[10px] text-slate-600">{p.role}</span>
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-400">
              {p.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {onScroll ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {p.id === "monday-scout" ? (
                  <Jump onClick={() => onScroll("monday-pack")} label="Monday pack" />
                ) : null}
                {p.id === "densify-recipe" ? (
                  <>
                    <Jump
                      onClick={() => onScroll("problem-unit-op-search")}
                      label="Unit-op search"
                    />
                    <Jump
                      onClick={() => onScroll("local-text-enrich")}
                      label="Paste wizard"
                    />
                  </>
                ) : null}
                {p.id === "site-fill" ? (
                  <Jump onClick={() => onScroll("site-fill")} label="Site fill" />
                ) : null}
                {p.id === "ip-lit" ? (
                  <Jump onClick={() => onScroll("literature")} label="Literature" />
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function Jump({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-teal-300/90 hover:border-teal-500/40"
    >
      {label} →
    </button>
  );
}
