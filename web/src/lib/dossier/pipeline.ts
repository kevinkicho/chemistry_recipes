/**
 * Dossier pipeline with realtime progress (for SSE overlay).
 * Free APIs first → curated-style evidence scaffold → optional Ollama enhance.
 * Never blocks forever on AI: timeout falls back to evidence scaffold.
 */

import {
  aiRoutesToProcessRoutes,
  synthesizeDossierFromEvidence,
} from "@/lib/dossier/synthesize";
import { buildScaffoldDossier } from "@/lib/dossier/scaffold";
import { scoreCompoundEvidence } from "@/lib/dossier/evidenceScore";
import { gatherCompoundEvidence } from "@/lib/dossier/gather";
import {
  extractProcessFacts,
  preferRoutesForEvidence,
  stripUncitedRouteDetails,
} from "@/lib/dossier/processFacts";
import { applyPlantDeliverables } from "@/lib/dossier/plantDeliverables";
import { applyTierABaseline } from "@/lib/dossier/tierABaseline";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  createProgressClock,
  previewText,
  type ProgressEmitter,
} from "@/lib/dossier/progress";
import { getServerAiEnv } from "@/lib/ai/serverEnv";
import type { ApiFetchTrace } from "@/lib/api/trace";
import { inferModalityFromText } from "@/lib/modality/templates";
import type { DossierBuildAudit } from "@/lib/dossier/types";
import {
  mergeRelatedEntities,
  relatedFromEvidenceText,
  relatedFromRoutes,
  withEntityLinks,
} from "@/lib/dossier/relatedEntities";
import {
  detectEvidenceContradictions,
  mergeContradictions,
} from "@/lib/dossier/contradictions";
import { fillModalityUnitOps } from "@/lib/dossier/unitOpFill";

const STEPS_TOTAL = 5;

function summarizeTraces(traces: ApiFetchTrace[]): {
  endpointUrl?: string;
  method?: string;
  httpStatus?: number;
  ok: boolean;
  responsePreview?: string;
  detail: string;
} {
  if (!traces.length) {
    return { ok: false, detail: "No HTTP traces" };
  }
  const last = traces[traces.length - 1];
  const okCount = traces.filter((t) => t.ok).length;
  const failCount = traces.length - okCount;
  return {
    endpointUrl: last.endpointUrl,
    method: last.method,
    httpStatus: last.httpStatus,
    ok: okCount > 0,
    responsePreview: previewText(last.responseBody, 320),
    detail: `${traces.length} request(s) · ${okCount} ok${failCount ? ` · ${failCount} failed` : ""}`,
  };
}

export interface PipelineOptions {
  /** User-selected primary model (from browser AI settings) */
  model?: string;
  /** User-selected fast/draft model */
  fastModel?: string;
}

/**
 * Build live dossier while emitting progress events for the freeze overlay.
 */
export async function buildLiveDossierWithProgress(
  cid: number,
  onProgress: ProgressEmitter,
  opts: PipelineOptions = {}
): Promise<LiveDossier> {
  const clock = createProgressClock();
  let stepsDone = 0;
  const auditStartedAt = new Date().toISOString();
  const auditSteps: DossierBuildAudit["steps"] = [];

  // Always attach current stepsDone/stepsTotal so SSE heartbeats never
  // wipe the client's progress bar back to 0.
  const emit: ProgressEmitter = (e) => {
    const full = {
      ...e,
      t: e.t ?? clock.elapsed(),
      stepsDone: e.stepsDone ?? stepsDone,
      stepsTotal: e.stepsTotal ?? STEPS_TOTAL,
    };
    if (
      e.type === "step_done" ||
      e.type === "step_error" ||
      e.type === "step_start"
    ) {
      if (e.stepId && e.type !== "step_start") {
        auditSteps.push({
          id: e.stepId,
          label: e.label || e.stepId,
          ok: e.type === "step_done" ? e.ok !== false : e.ok,
          durationMs: e.durationMs,
          detail: e.detail,
        });
      }
    }
    clock.emit(full);
    onProgress(full);
  };

  const tickDone = () => {
    stepsDone += 1;
    return { stepsDone, stepsTotal: STEPS_TOTAL };
  };

  emit({
    type: "hello",
    label: "Starting live dossier build",
    detail: `PubChem CID ${cid} · free APIs (PubChem, Europe PMC, OpenAlex, patents) → evidence score → Ollama when warranted`,
    stepsDone: 0,
    stepsTotal: STEPS_TOTAL,
  });

  // ── 1–2. Free public evidence harvest ───────────────────────────
  emit({
    type: "step_start",
    stepId: "gather",
    label: "Harvest free public evidence",
    organization: "NIH · EMBL-EBI · OpenAlex · USPTO",
    detail:
      "PubChem + ChEMBL + MyChem + openFDA + RxNorm + KEGG + CompTox + DailyMed + Europe PMC + OpenAlex + Crossref + Semantic Scholar + patents",
    stepsDone,
    stepsTotal: STEPS_TOTAL,
  });
  const tGather = Date.now();
  const evidence = await gatherCompoundEvidence(cid);
  const gSum = summarizeTraces(evidence.traces);
  emit({
    type: evidence.identity ? "step_done" : "step_error",
    stepId: "gather",
    label: "Free public evidence harvest",
    organization: "Multi-source",
    endpointUrl: gSum.endpointUrl,
    method: "GET",
    httpStatus: gSum.httpStatus,
    ok: Boolean(evidence.identity) || evidence.literature.length > 0,
    durationMs: Date.now() - tGather,
    responsePreview: gSum.responsePreview,
    detail: `${evidence.identity?.name || "CID " + cid} · ${evidence.literature.length} lit · ${evidence.patents.length} patents · ${evidence.traces.length} HTTP captures`,
    hits: evidence.literature.length + evidence.patents.length,
    ...tickDone(),
  });

  // progress step 2 reserved for scoring detail in scaffold
  emit({
    type: "step_done",
    stepId: "score",
    label: "Evidence scored",
    ok: true,
    detail: "Process-literature richness computed for AI gate",
    ...tickDone(),
  });

  // ── 6. Thin API shell + evidence score (emit partial for early UI) ─
  emit({
    type: "step_start",
    stepId: "scaffold",
    label: "Assemble public-evidence shell",
    detail:
      "Identity, GHS, process literature leads only — no PubChem TOC blurbs as steps",
    stepsDone,
    stepsTotal: STEPS_TOTAL,
  });
  const tSc = Date.now();
  const processFacts = evidence.processFacts ?? extractProcessFacts(evidence);
  evidence.processFacts = processFacts;
  const scored = scoreCompoundEvidence(evidence);
  let dossier = buildScaffoldDossier(evidence);
  dossier = {
    ...dossier,
    processFacts,
    evidenceScore: {
      score: scored.score,
      confidence: scored.confidence,
      shouldSynthesize: scored.shouldSynthesize,
      preferFastModel: scored.preferFastModel,
      reasons: scored.reasons,
      processLitCount: scored.processLitCount,
      processPatentCount: scored.processPatentCount,
      processFactConditions: scored.processFactConditions,
      unitOpFacts: scored.unitOpFacts,
      productionBriefEligible: scored.productionBriefEligible,
      explainer: scored.explainer,
      aiRecommendation: scored.aiRecommendation,
    },
    buildMode: "evidence-shell",
  };
  emit({
    type: "step_done",
    stepId: "scaffold",
    label: "Evidence shell ready",
    ok: true,
    durationMs: Date.now() - tSc,
    evidenceScore: scored.score,
    detail: `Score ${scored.score}/100 (${scored.confidence}) · facts ${processFacts.sourcedConditionCount} cond / ${processFacts.unitOpCount} ops · ${dossier.literature.length} lit · ${dossier.patents.length} patents · ${dossier.annotations?.length || 0} multi-source`,
    ...tickDone(),
  });

  // Early shell for client — dossier usable while Ollama runs
  emit({
    type: "partial",
    label: "Shell available",
    detail: "Showing free-public evidence shell; AI synthesis may still run…",
    evidenceScore: scored.score,
    dossier,
  });

  // ── 7. Ollama dual-view synthesis (gated by evidence score) ──────
  const aiEnv = getServerAiEnv();
  const orgLabel =
    aiEnv.provider === "ollama-local" ? "Ollama local" : "Ollama Cloud";
  const runAi = aiEnv.canCall && scored.shouldSynthesize;

  if (!runAi) {
    emit({
      type: "step_done",
      stepId: "ollama",
      label: "Ollama synthesis skipped",
      organization: orgLabel,
      ok: true,
      detail: !aiEnv.canCall
        ? "No Ollama Cloud key and host is not local — evidence shell only"
        : `Evidence score ${scored.score} below threshold — skipped heavy AI (literature leads kept)`,
      ...tickDone(),
    });
    dossier = {
      ...dossier,
      buildMode: aiEnv.canCall ? "ai-skipped-thin-evidence" : "evidence-shell",
      synthesis: {
        ...dossier.synthesis,
        available: aiEnv.canCall,
        confidence: scored.confidence,
        gaps: [
          ...(dossier.synthesis.gaps || []),
          !aiEnv.canCall
            ? "Set OLLAMA_CLOUD_API_KEY or OLLAMA_HOST=http://127.0.0.1:11434 for dual-view synthesis"
            : "Thin process evidence — AI skipped to avoid low-quality invention",
        ],
      },
    };
  } else {
    emit({
      type: "step_start",
      stepId: "ollama",
      label: `${orgLabel} process synthesis (stream)`,
      organization: orgLabel,
      endpointUrl: `${aiEnv.host}/api/chat`,
      method: "POST",
      detail: scored.preferFastModel
        ? `Draft/fast model path · score ${scored.score} · ~90s cap`
        : `Full model path · score ${scored.score} · ~90s cap`,
      stepsDone,
      stepsTotal: STEPS_TOTAL,
    });

    const tAi = Date.now();
    const synthesis = await synthesizeDossierFromEvidence(evidence, emit, {
      preferFastModel: scored.preferFastModel,
      model: opts.model,
      fastModel: opts.fastModel,
    });

    if (synthesis.parsed && synthesis.routes && synthesis.routes.length > 0) {
      const editorialRef = [
        {
          type: "editorial" as const,
          id: `ollama-synthesis:${cid}`,
          label: `${orgLabel} synthesis from public evidence`,
          note: synthesis.model
            ? `Model ${synthesis.model} — structure only; uncited numbers stripped`
            : "AI synthesis — structure only; uncited numbers stripped",
        },
      ];
      let aiRoutes = aiRoutesToProcessRoutes(synthesis.routes, editorialRef);
      aiRoutes = stripUncitedRouteDetails(aiRoutes, processFacts);
      aiRoutes = preferRoutesForEvidence(aiRoutes, processFacts);
      const processRoutes = aiRoutes.length ? aiRoutes : dossier.processRoutes;
      const relatedEntities = withEntityLinks(
        mergeRelatedEntities(
          synthesis.relatedEntities || [],
          relatedFromRoutes(processRoutes),
          relatedFromEvidenceText(evidence)
        )
      );
      const contradictions = mergeContradictions(
        synthesis.contradictions || [],
        detectEvidenceContradictions(evidence, processRoutes)
      );
      dossier = {
        ...dossier,
        processRoutes,
        relatedEntities,
        contradictions,
        modality: synthesis.modality || dossier.modality,
        synthesis: {
          ...synthesis,
          confidence: synthesis.confidence || scored.confidence,
          apparatusCatalog:
            synthesis.apparatusCatalog?.length
              ? synthesis.apparatusCatalog
              : dossier.synthesis.apparatusCatalog,
          environmentBaseline:
            synthesis.environmentBaseline || dossier.synthesis.environmentBaseline,
          ehsHighlights:
            synthesis.ehsHighlights?.length
              ? synthesis.ehsHighlights
              : dossier.synthesis.ehsHighlights,
          relatedEntities,
          contradictions,
          provenance: synthesis.provenance,
        },
        disclaimer: synthesis.disclaimer || dossier.disclaimer,
        generatedAt: new Date().toISOString(),
        buildMode: "ai",
      };
    } else {
      dossier = {
        ...dossier,
        buildMode: "evidence-shell",
        synthesis: {
          ...dossier.synthesis,
          available: synthesis.available,
          model: synthesis.model,
          rawError: synthesis.rawError,
          parsed: false,
          provenance: synthesis.provenance ?? dossier.synthesis.provenance,
          confidence: scored.confidence,
          gaps: [
            ...(dossier.synthesis.gaps || []),
            synthesis.rawError ||
              "Ollama did not return quality-gated routes — literature/patent leads only",
          ],
        },
      };
    }

    emit({
      type: synthesis.parsed ? "step_done" : "step_error",
      stepId: "ollama",
      label: `${orgLabel} synthesis`,
      organization: orgLabel,
      endpointUrl: `${aiEnv.host}/api/chat`,
      method: "POST",
      ok: Boolean(synthesis.parsed),
      durationMs: Date.now() - tAi,
      responsePreview: previewText(
        synthesis.overview ||
          synthesis.rawError ||
          (synthesis.parsed ? "JSON OK" : ""),
        320
      ),
      detail: synthesis.parsed
        ? `Dual-view routes ready · AI confidence ${synthesis.confidence ?? "?"} · evidence ${scored.score} · ${synthesis.model}`
        : `${synthesis.rawError || "AI incomplete"} — evidence shell kept`,
      hits: synthesis.routes?.length,
      ...tickDone(),
    });
  }

  const modalityText = [
    dossier.identity?.name,
    dossier.synthesis.overview,
    dossier.synthesis.manufacturingSummary,
    dossier.manufacturingTexts.slice(0, 2).join(" "),
    dossier.literature
      .slice(0, 5)
      .map((h) => h.title)
      .join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const modality =
    dossier.modality ||
    dossier.synthesis.modality ||
    inferModalityFromText(modalityText || "small molecule");

  // Always enrich related entities + contradictions (even without AI)
  const relatedEntities = withEntityLinks(
    mergeRelatedEntities(
      dossier.relatedEntities || [],
      dossier.synthesis.relatedEntities || [],
      relatedFromRoutes(dossier.processRoutes),
      relatedFromEvidenceText(evidence)
    )
  );
  const contradictions = mergeContradictions(
    dossier.contradictions || [],
    dossier.synthesis.contradictions || [],
    detectEvidenceContradictions(evidence, dossier.processRoutes)
  );
  const unitOpFills = fillModalityUnitOps(modality, dossier.processRoutes);

  const finishedAt = new Date().toISOString();
  const buildAudit: DossierBuildAudit = {
    startedAt: auditStartedAt,
    finishedAt,
    durationMs: clock.elapsed(),
    cid,
    steps: auditSteps,
    model: dossier.synthesis.model || opts.model,
    fastModelPreferred: scored.preferFastModel,
    apiTraceCount: dossier.traces.length,
    literatureCount: dossier.literature.length,
    patentCount: dossier.patents.length,
    evidenceScore: scored.score,
    buildMode: dossier.buildMode,
  };

  dossier = {
    ...dossier,
    processFacts: dossier.processFacts || processFacts,
    processFraming:
      (dossier.processFacts || processFacts).framing || "evidence-lead-pack",
    modality,
    relatedEntities,
    contradictions,
    unitOpFills,
    buildAudit,
    generatedAt: dossier.generatedAt || finishedAt,
    synthesis: {
      ...dossier.synthesis,
      relatedEntities,
      contradictions,
      unitOpFills,
      modality,
      gaps: [
        ...(dossier.synthesis.gaps || []),
        // de-dupe later in UI if needed
      ].filter((g, i, a) => a.indexOf(g) === i),
    },
  };

  // Example-like plant sections from free-public facts when AI left them empty
  dossier = applyPlantDeliverables(dossier);
  // Hub CIDs: merge curated Tier-A teaching routes/entities (labeled editorial)
  dossier = applyTierABaseline(dossier);
  // Re-apply plant deliverables so BOM/related merge stays consistent
  dossier = applyPlantDeliverables(dossier);

  emit({
    type: "complete",
    label: "Dossier ready",
    detail: `Total ${clock.elapsed()} ms · Tier ${dossier.tier} · mode ${dossier.buildMode} · routes ${dossier.processRoutes.length} · ${modality}`,
    stepsDone: STEPS_TOTAL,
    stepsTotal: STEPS_TOTAL,
    evidenceScore: scored.score,
    dossier,
  });

  return dossier;
}
