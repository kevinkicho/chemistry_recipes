"use client";

import { AiProvenance } from "@/components/AiProvenance";
import { ApiProvenance } from "@/components/ApiProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import type { ApiFetchTrace } from "@/lib/api/trace";
import type { AiProvenanceRecord } from "@/lib/dossier/types";

type PlantProps = {
  molecularWeight?: number | string | null;
  formula?: string | null;
  meltingPointC?: string;
  appearance?: string;
  solubility?: string;
};

export function LiveDossierAside({
  dossier,
  name,
  cid,
  manufacturingSummary,
  mfgPanelLead,
  mfgFromAi,
  environmentBaseline,
  envFromAi,
  apparatusCatalog,
  apparatusFromAi,
  ehs,
  ehsFromAi,
  plantProps,
  aiChip,
  aiAttempt,
  pugViewTraces,
  pubchemTraces,
  allTraces,
}: {
  dossier: LiveDossier;
  name: string;
  cid: number;
  manufacturingSummary: string | null;
  mfgPanelLead?: string;
  mfgFromAi: boolean;
  environmentBaseline: LiveDossier["synthesis"]["environmentBaseline"];
  envFromAi: boolean;
  apparatusCatalog: NonNullable<LiveDossier["synthesis"]["apparatusCatalog"]>;
  apparatusFromAi: boolean;
  ehs: string[];
  ehsFromAi: boolean;
  plantProps: PlantProps;
  aiChip: AiProvenanceRecord | null;
  aiAttempt: AiProvenanceRecord | null;
  pugViewTraces: ApiFetchTrace[];
  pubchemTraces: ApiFetchTrace[];
  allTraces: ApiFetchTrace[];
}) {
  const hit = dossier.identity;
  const ai = dossier.synthesis;

  return (
    <aside className="space-y-4">
      <div
        id="manufacturing"
        className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-teal-300">Manufacturing summary</h3>
          {mfgFromAi && aiChip ? (
            <AiProvenance provenance={aiChip} field="Manufacturing summary" label="AI" />
          ) : (
            <ApiProvenance
              pubchemCid={cid}
              traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
              title="Manufacturing summary"
              label="API"
            />
          )}
        </div>
        {manufacturingSummary || mfgPanelLead ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {manufacturingSummary || mfgPanelLead}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            No manufacturing summary in free evidence yet. See Public manufacturing
            panel and literature below, or open{" "}
            <a
              href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Use-and-Manufacturing`}
              target="_blank"
              rel="noreferrer"
              className="text-teal-400 hover:underline"
            >
              PubChem Use &amp; Manufacturing
            </a>
            .
          </p>
        )}
      </div>

      {environmentBaseline ? (
        <div
          id="environment"
          className="scroll-mt-24 space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-teal-300">
              Plant environment baseline
            </h3>
            {envFromAi && aiChip ? (
              <AiProvenance
                provenance={aiChip}
                field="Plant environment baseline"
                label="AI"
              />
            ) : null}
          </div>
          {environmentBaseline.atmosphere ? (
            <p className="text-sm text-slate-300">
              <span className="text-slate-500">Atmosphere: </span>
              {environmentBaseline.atmosphere}
            </p>
          ) : null}
          {environmentBaseline.containment ? (
            <p className="text-sm text-slate-300">
              <span className="text-slate-500">Containment: </span>
              {environmentBaseline.containment}
            </p>
          ) : null}
          {environmentBaseline.atexZone ? (
            <p className="text-sm text-slate-300">
              <span className="text-slate-500">Zoning: </span>
              {environmentBaseline.atexZone}
            </p>
          ) : null}
          {environmentBaseline.utilities?.length ? (
            <p className="text-sm text-slate-400">
              Utilities: {environmentBaseline.utilities.join(" · ")}
            </p>
          ) : null}
          {environmentBaseline.notes ? (
            <p className="text-xs text-slate-500">{environmentBaseline.notes}</p>
          ) : null}
        </div>
      ) : null}

      {apparatusCatalog.length > 0 ? (
        <div
          id="apparatus"
          className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-teal-300">Apparatus catalog</h3>
            {aiChip && (apparatusFromAi || ai.parsed) ? (
              <AiProvenance provenance={aiChip} field="Apparatus catalog" label="AI" />
            ) : null}
          </div>
          <ul className="space-y-2 text-sm">
            {apparatusCatalog.map((a, i) => (
              <li key={i} className="border-b border-slate-800/80 pb-2 last:border-0">
                <code className="text-xs text-teal-200/90">{a.equipmentClass}</code>
                {a.materialOfConstruction ? (
                  <div className="text-xs text-slate-500">{a.materialOfConstruction}</div>
                ) : null}
                {a.notes ? <div className="text-xs text-slate-400">{a.notes}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ehs.length > 0 ? (
        <div
          id="ehs"
          className="scroll-mt-24 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-rose-300">EHS highlights</h3>
            {ehsFromAi && aiChip ? (
              <AiProvenance provenance={aiChip} field="EHS highlights" label="AI" />
            ) : (
              <ApiProvenance
                pubchemCid={cid}
                traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
                sourceRefs={dossier.hazards.sourceRefs}
                title="EHS / GHS"
                label="API"
              />
            )}
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
            {ehs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        id="hazards"
        className="scroll-mt-24 space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Hazards (summary)</h3>
          <ApiProvenance
            pubchemCid={cid}
            traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
            sourceRefs={dossier.hazards.sourceRefs}
            title="PubChem PUG View · GHS / hazards"
            label="API"
          />
        </div>
        {dossier.hazards.signalWord ? (
          <p className="text-sm text-amber-200/90">
            Signal: {dossier.hazards.signalWord}
          </p>
        ) : null}
        {dossier.hazards.hazardStatements &&
        dossier.hazards.hazardStatements.length > 0 ? (
          <ul className="max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-slate-400">
            {dossier.hazards.hazardStatements.slice(0, 12).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">
            {dossier.hazards.notes || "No GHS text returned for this CID."}
          </p>
        )}
      </div>

      <div
        id="properties"
        className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Properties</h3>
          <ApiProvenance
            pubchemCid={cid}
            traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
            title="PubChem properties"
            label="API"
          />
        </div>
        <dl className="space-y-1 text-sm text-slate-400">
          {plantProps.molecularWeight != null ? (
            <div>
              <span className="text-slate-600">MW </span>
              {plantProps.molecularWeight}
            </div>
          ) : null}
          {plantProps.formula ? (
            <div>
              <span className="text-slate-600">Formula </span>
              {plantProps.formula}
            </div>
          ) : null}
          {plantProps.meltingPointC ? (
            <div>
              <span className="text-slate-600">mp </span>
              {plantProps.meltingPointC} °C
            </div>
          ) : null}
          {plantProps.appearance ? (
            <div>
              <span className="text-slate-600">Appearance </span>
              {plantProps.appearance}
            </div>
          ) : null}
          {plantProps.solubility ? (
            <div>
              <span className="text-slate-600">Solubility </span>
              {plantProps.solubility}
            </div>
          ) : null}
          {hit?.smiles ? (
            <div className="break-all text-xs">
              <span className="text-slate-600">SMILES </span>
              {hit.smiles}
            </div>
          ) : null}
          {hit?.molecularWeight == null &&
          !plantProps.meltingPointC &&
          !plantProps.appearance ? (
            <div className="text-slate-600">No property excerpts in this capture.</div>
          ) : null}
        </dl>
        {dossier.propertyTexts.length > 0 ? (
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-500">
            {dossier.propertyTexts.slice(0, 8).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div
        id="sources"
        className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Sources</h3>
        <p className="mb-2 text-xs text-slate-500">
          {allTraces.length} live HTTP capture{allTraces.length === 1 ? "" : "s"}.
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-500">
          {dossier.sourceRefs.slice(0, 14).map((r, i) => (
            <li key={`${r.type}:${r.id}:${i}`}>
              <span className="uppercase text-slate-600">{r.type}</span>
              {" · "}
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400/90 hover:underline"
                >
                  {(r.label || r.id).slice(0, 56)}
                </a>
              ) : (
                (r.label || r.id).slice(0, 56)
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <ApiProvenance
            pubchemCid={cid}
            traces={allTraces}
            title={name}
            label="Open provenance"
            sourceRefs={dossier.sourceRefs}
          />
          {aiAttempt ? (
            <AiProvenance
              provenance={aiAttempt}
              field="Full synthesis provenance"
              label="AI"
            />
          ) : null}
        </div>
      </div>

      {ai.gaps && ai.gaps.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-400">Evidence gaps</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
            {ai.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
