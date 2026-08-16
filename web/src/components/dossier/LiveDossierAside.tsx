"use client";

import { ContentProvenance } from "@/components/ContentProvenance";
import { AiProvenance } from "@/components/AiProvenance";
import { ApiProvenance } from "@/components/ApiProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import type { ApiFetchTrace } from "@/lib/api/trace";
import {
  formatSectionEmptyCopy,
  isProcessFactSourceRef,
  isProcessFactTrace,
} from "@/lib/dossier/sectionHonesty";
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
  aiMfg,
  aiEnv,
  aiApparatus,
  aiEhs,
  aiAttempt,
  pugViewTraces,
  pubchemTraces,
  ghsTraces,
  propertyTraces,
  propertySourceRefs,
  allTraces,
  onRegenerate,
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
  /** Field-specific AI provenance (preferred over generic aiChip) */
  aiMfg?: AiProvenanceRecord | null;
  aiEnv?: AiProvenanceRecord | null;
  aiApparatus?: AiProvenanceRecord | null;
  aiEhs?: AiProvenanceRecord | null;
  aiAttempt: AiProvenanceRecord | null;
  pugViewTraces: ApiFetchTrace[];
  pubchemTraces: ApiFetchTrace[];
  ghsTraces: ApiFetchTrace[];
  propertyTraces: ApiFetchTrace[];
  propertySourceRefs: LiveDossier["sourceRefs"];
  allTraces: ApiFetchTrace[];
  onRegenerate?: () => void;
}) {
  const hit = dossier.identity;
  // Prefer full harvest traces so multi-API sourceRefs (ChEMBL, RxNorm, EPMC, …)
  // can hydrate with real HTTP captures. Fall back to PubChem-only if empty.
  const apiTraces =
    allTraces.length > 0
      ? allTraces
      : pugViewTraces.length
        ? pugViewTraces
        : pubchemTraces;
  // Environment / apparatus / evidence gaps derive from process facts
  // (literature, patents, manufacturing, GHS). Leftover identity / annotation
  // HTTP is not plant or gap provenance.
  const plantTraces = apiTraces.filter((t) => isProcessFactTrace(t.endpointUrl));
  const plantSourceRefs = (dossier.sourceRefs || []).filter(isProcessFactSourceRef);
  const mfgAi = aiMfg || (mfgFromAi ? aiChip : null);
  const envAi = aiEnv || (envFromAi ? aiChip : null);
  const apparatusAi = aiApparatus || (apparatusFromAi ? aiChip : null);
  const ehsAi = aiEhs || (ehsFromAi ? aiChip : null);
  const hazardEmpty = formatSectionEmptyCopy({
    family: "hazards",
    traces: allTraces,
    fetchErrors: dossier.fetchErrors,
  });
  const propertyEmpty = formatSectionEmptyCopy({
    family: "properties",
    traces: allTraces,
    fetchErrors: dossier.fetchErrors,
  });
  const mfgEmpty = formatSectionEmptyCopy({
    family: "manufacturing",
    traces: allTraces,
    fetchErrors: dossier.fetchErrors,
  });

  return (
    <aside className="space-y-4">
      <div
        id="manufacturing"
        className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
        data-toc-empty={
          manufacturingSummary || mfgPanelLead ? "0" : "1"
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-teal-300">Manufacturing summary</h3>
          <ContentProvenance
            title="Manufacturing summary"
            field="Manufacturing summary"
            pubchemCid={cid}
            traces={apiTraces}
            sourceRefs={dossier.sourceRefs}
            ai={mfgAi}
            showAi={Boolean(mfgAi)}
            onRegenerate={onRegenerate}
          />
          {!mfgAi && manufacturingSummary ? (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">
              free-public / PubChem
            </span>
          ) : null}
        </div>
        {manufacturingSummary || mfgPanelLead ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {manufacturingSummary || mfgPanelLead}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {mfgEmpty.message} See Public manufacturing
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
            <ContentProvenance
              title="Plant environment baseline"
              field="Plant environment baseline"
              traces={plantTraces}
              sourceRefs={plantSourceRefs}
              ai={envAi}
              showAi={Boolean(envAi)}
              onRegenerate={onRegenerate}
            />
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
            <ContentProvenance
              title="Apparatus catalog"
              field="Apparatus catalog"
              traces={plantTraces}
              sourceRefs={plantSourceRefs}
              ai={apparatusAi}
              showAi={Boolean(apparatusAi)}
              onRegenerate={onRegenerate}
            />
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
            <ContentProvenance
              title="EHS / GHS"
              field="EHS highlights"
              pubchemCid={cid}
              traces={ghsTraces}
              sourceRefs={dossier.hazards.sourceRefs}
              ai={ehsAi}
              showAi={Boolean(ehsAi)}
              onRegenerate={onRegenerate}
            />
            {!ehsAi && ehs.length ? (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">
                PubChem GHS / free-public
              </span>
            ) : null}
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
        data-toc-empty={
          dossier.hazards.signalWord ||
          (dossier.hazards.hazardStatements &&
            dossier.hazards.hazardStatements.length > 0)
            ? "0"
            : "1"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Hazards (summary)</h3>
          <ApiProvenance
            pubchemCid={cid}
            traces={ghsTraces}
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
            {hazardEmpty.message}
          </p>
        )}
      </div>

      <div
        id="properties"
        className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
        data-toc-empty={
          plantProps.molecularWeight != null ||
          plantProps.formula ||
          plantProps.meltingPointC ||
          plantProps.appearance ||
          plantProps.solubility ||
          hit?.smiles ||
          dossier.propertyTexts.length > 0
            ? "0"
            : "1"
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Properties</h3>
          <ApiProvenance
            pubchemCid={cid}
            traces={propertyTraces}
            sourceRefs={propertySourceRefs}
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
            <div className="text-slate-600">{propertyEmpty.message}</div>
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
              onRegenerate={onRegenerate}
            />
          ) : null}
        </div>
      </div>

      {dossier.synthesis.gaps && dossier.synthesis.gaps.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-400">Evidence gaps</h3>
            <ContentProvenance
              title="Evidence gaps"
              field="Evidence gaps"
              traces={plantTraces}
              sourceRefs={plantSourceRefs}
              ai={
                aiChip && dossier.synthesis.parsed
                  ? aiChip
                  : null
              }
              showAi={Boolean(aiChip && dossier.synthesis.parsed)}
              onRegenerate={onRegenerate}
            />
          </div>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
            {dossier.synthesis.gaps.map((g: string, i: number) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
