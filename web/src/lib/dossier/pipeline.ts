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
import { groundRoutesAgainstEvidence } from "@/lib/dossier/quoteGrounding";
import { attachQuotesToRoutes } from "@/lib/dossier/attachQuotesToRoutes";
import { mergeExtractAtomsIntoFacts } from "@/lib/dossier/mergeExtractAtoms";
import { applyPlantDeliverables } from "@/lib/dossier/plantDeliverables";

import { withRecipeReadiness } from "@/lib/dossier/recipeReadiness";
import { withIdealPageParity } from "@/lib/dossier/idealPage";
import { withProcessKnowledge } from "@/lib/frontier/buildKnowledge";
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
import { executeIdealDensifyPlan } from "@/lib/dossier/idealDensifyPlan";
import { assessIdealPageParity } from "@/lib/dossier/idealPage";
import type { CompoundEvidence } from "@/lib/dossier/types";

const STEPS_TOTAL = 5;

/**
 * After quality-gate / AI failure: one ideal-section densify pass, then re-AI once.
 * Etiquette rails stay inside tools; never invent plant numbers.
 */
async function recoverEvidenceAfterQualityGate(
  evidence: CompoundEvidence,
  shell: LiveDossier,
  emit: ProgressEmitter
): Promise<CompoundEvidence> {
  const parity = assessIdealPageParity(shell);
  const weak = parity.sections.filter((s) => !s.filled || s.depth < 45);
  if (!weak.length) return evidence;

  emit({
    type: "log",
    stepId: "recover",
    label: "Ideal-close densify recovery",
    detail: `Weak sections: ${weak
      .slice(0, 6)
      .map((s) => `${s.id}(${s.depth})`)
      .join(", ")} — one etiquette-aware densify pass before re-AI`,
  });

  const result = await executeIdealDensifyPlan(evidence, parity.sections, {
    onStep: (detail) =>
      emit({
        type: "log",
        stepId: "recover",
        label: "Ideal-close tool",
        detail,
      }),
  });

  emit({
    type: "log",
    stepId: "recover",
    label: "Ideal-close complete",
    detail: result.summary,
  });

  return {
    ...result.evidence,
    processFacts:
      result.evidence.processFacts ?? extractProcessFacts(result.evidence),
    fetchErrors: [
      ...(result.evidence.fetchErrors || []),
      `pipeline · ideal-close recovery · ${result.toolsRun.join("→") || "none"}`,
    ].slice(0, 80),
  };
}

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
  /** Skip durable evidence cache and re-gather free APIs */
  force?: boolean;
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
      "Multi-API harvest (soft-fail) + durable evidence cache + densify pass when thin · PubChem · EPMC/OA · PubMed · arXiv · OrgSyn · patents · UniChem/ChEBI/GSRS · ORD · Rhea/KEGG",
    stepsDone,
    stepsTotal: STEPS_TOTAL,
  });
  const tGather = Date.now();
  let evidence = await gatherCompoundEvidence(cid, {
    force: Boolean(opts.force),
  });
  const gSum = summarizeTraces(evidence.traces);
  const agent = evidence.harvestAgent;
  emit({
    type: evidence.identity ? "step_done" : "step_error",
    stepId: "gather",
    label: "Free public evidence harvest + API agent",
    organization: "Multi-source · harvest agent",
    endpointUrl: gSum.endpointUrl,
    method: "GET",
    httpStatus: gSum.httpStatus,
    ok: Boolean(evidence.identity) || evidence.literature.length > 0,
    durationMs: Date.now() - tGather,
    responsePreview: gSum.responsePreview,
    detail: [
      `${evidence.identity?.name || "CID " + cid}`,
      `${evidence.literature.length} lit · ${evidence.patents.length} patents · ${evidence.traces.length} HTTP`,
      agent
        ? `agent ${agent.planner}${agent.usedLlm ? "+llm" : ""} · compliance ${agent.compliance.grade} ${agent.compliance.score} · tools ${agent.toolsRun.join("→") || "—"}`
        : "agent n/a",
    ].join(" · "),
    hits: evidence.literature.length + evidence.patents.length,
    ...tickDone(),
  });
  if (agent?.steps?.length) {
    for (const s of agent.steps.slice(0, 12)) {
      emit({
        type: "log",
        stepId: "gather",
        label: `API agent · ${s.role}${s.tool ? ` · ${s.tool}` : ""}`,
        detail: s.detail,
        durationMs: s.durationMs,
      });
    }
  }

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
  let processFacts = evidence.processFacts ?? extractProcessFacts(evidence);
  evidence.processFacts = processFacts;
  let scored = scoreCompoundEvidence(evidence);
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

  // Early shell for client — densified public dashboard while AI dual-view runs
  emit({
    type: "partial",
    label: "Data dashboard ready",
    detail:
      "Free-public harvest densified — AI dual-view structuring manufacturing + mechanism views…",
    evidenceScore: scored.score,
    dossier,
  });

  // ── 7. Ollama dual-view synthesis (AI-integral product mode) ──────
  // Always run when the server can call Ollama and identity is resolved.
  // Quality gate still strips uncited plant numbers — never invent site CPPs.
  const aiEnv = getServerAiEnv();
  const orgLabel =
    aiEnv.provider === "ollama-local" ? "Ollama local" : "Ollama Cloud";
  const runAi = aiEnv.canCall && Boolean(evidence.identity);

  if (!runAi) {
    emit({
      type: "step_done",
      stepId: "ollama",
      label: "AI dual-view unavailable",
      organization: orgLabel,
      ok: true,
      detail: !aiEnv.canCall
        ? "AI is integral — set OLLAMA_CLOUD_API_KEY (App Hosting secret) or local OLLAMA_HOST. Showing process-first public shell until AI is configured."
        : "Identity missing — cannot run AI dual-view",
      ...tickDone(),
    });
    dossier = {
      ...dossier,
      buildMode: "evidence-shell",
      synthesis: {
        ...dossier.synthesis,
        available: false,
        confidence: scored.confidence,
        gaps: [
          ...(dossier.synthesis.gaps || []),
          !aiEnv.canCall
            ? "AI dual-view requires OLLAMA_CLOUD_API_KEY (or local ollama serve). Free-public densify shell is still AI-ready input."
            : "Identity missing — AI deferred",
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
        ? `Draft/fast model · score ${scored.score} · densified package · ~75s cap`
        : `Full model · score ${scored.score} · high-value densified package (procedure+atoms) · ~120s cap`,
      stepsDone,
      stepsTotal: STEPS_TOTAL,
    });

    const tAi = Date.now();
    let workingEvidence = evidence;
    let workingFacts = processFacts;
    let workingScored = scored;

    const runSynthesis = () =>
      synthesizeDossierFromEvidence(workingEvidence, emit, {
        preferFastModel: workingScored.preferFastModel,
        model: opts.model,
        fastModel: opts.fastModel,
      });

    const applyAiRoutes = (
      synthesis: Awaited<ReturnType<typeof synthesizeDossierFromEvidence>>
    ): { ok: boolean; emptiedByGate: boolean } => {
      if (!synthesis.parsed || !synthesis.routes?.length) {
        return { ok: false, emptiedByGate: false };
      }
      let factsForGround = workingFacts;
      if (synthesis.pass1Extract) {
        const merged = mergeExtractAtomsIntoFacts(
          workingFacts,
          synthesis.pass1Extract,
          workingEvidence
        );
        if (merged.added > 0 && merged.bundle) {
          factsForGround = merged.bundle;
          workingFacts = merged.bundle;
          workingEvidence = {
            ...workingEvidence,
            processFacts: merged.bundle,
          };
        }
      }
      const editorialRef = [
        {
          type: "editorial" as const,
          id: `ollama-synthesis:${cid}`,
          label: `${orgLabel} synthesis from public evidence`,
          note: synthesis.model
            ? `Model ${synthesis.model} · ${synthesis.synthesisPath || "single-pass"} — structure only; uncited numbers stripped`
            : "AI synthesis — structure only; uncited numbers stripped",
        },
      ];
      let aiRoutes = aiRoutesToProcessRoutes(synthesis.routes, editorialRef);
      aiRoutes = stripUncitedRouteDetails(aiRoutes, factsForGround);
      const grounded = groundRoutesAgainstEvidence(aiRoutes, {
        facts: factsForGround?.facts,
        dataFed: synthesis.provenance?.dataFed,
        mfgTexts: dossier.manufacturingTexts,
        procedureTexts: (workingEvidence.procedureExcerpts || []).map(
          (p) => p.text
        ),
      });
      aiRoutes = grounded.routes;
      const quoteBound = attachQuotesToRoutes(aiRoutes, factsForGround?.facts);
      aiRoutes = quoteBound.routes;
      aiRoutes = preferRoutesForEvidence(aiRoutes, factsForGround);
      if (!aiRoutes.length) {
        return { ok: false, emptiedByGate: true };
      }
      const processRoutes = aiRoutes;
      const relatedEntities = withEntityLinks(
        mergeRelatedEntities(
          synthesis.relatedEntities || [],
          relatedFromRoutes(processRoutes),
          relatedFromEvidenceText(workingEvidence)
        )
      );
      const contradictions = mergeContradictions(
        synthesis.contradictions || [],
        detectEvidenceContradictions(workingEvidence, processRoutes)
      );
      dossier = {
        ...dossier,
        processRoutes,
        processFacts: factsForGround,
        relatedEntities,
        contradictions,
        modality: synthesis.modality || dossier.modality,
        groundingReport: {
          ...grounded.report,
          quoteBind: quoteBound.report,
        },
        synthesis: {
          ...synthesis,
          confidence: synthesis.confidence || workingScored.confidence,
          apparatusCatalog:
            synthesis.apparatusCatalog?.length
              ? synthesis.apparatusCatalog
              : dossier.synthesis.apparatusCatalog,
          environmentBaseline:
            synthesis.environmentBaseline ||
            dossier.synthesis.environmentBaseline,
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
      return { ok: true, emptiedByGate: false };
    };

    let synthesis = await runSynthesis();
    let applied = applyAiRoutes(synthesis);

    // Horizon A: one ideal-close densify + re-AI when quality gate rejects or AI fails
    if (!applied.ok) {
      const reason = applied.emptiedByGate
        ? "Quality gate emptied AI routes"
        : synthesis.rawError || "AI dual-view incomplete";
      emit({
        type: "log",
        stepId: "ollama",
        label: "AI dual-view deferred — ideal-close recovery",
        detail: `${reason} · densify weak ideal sections once, then re-AI`,
      });
      try {
        workingEvidence = await recoverEvidenceAfterQualityGate(
          workingEvidence,
          dossier,
          emit
        );
        workingFacts =
          workingEvidence.processFacts ?? extractProcessFacts(workingEvidence);
        workingEvidence = {
          ...workingEvidence,
          processFacts: workingFacts,
        };
        workingScored = scoreCompoundEvidence(workingEvidence);
        processFacts = workingFacts;
        evidence = workingEvidence;
        scored = workingScored;
        dossier = {
          ...dossier,
          processFacts: workingFacts,
          evidenceScore: {
            ...dossier.evidenceScore!,
            score: workingScored.score,
            confidence: workingScored.confidence,
            shouldSynthesize: workingScored.shouldSynthesize,
            preferFastModel: workingScored.preferFastModel,
            reasons: workingScored.reasons,
            processLitCount: workingScored.processLitCount,
            processPatentCount: workingScored.processPatentCount,
            processFactConditions: workingScored.processFactConditions,
            unitOpFacts: workingScored.unitOpFacts,
            productionBriefEligible: workingScored.productionBriefEligible,
            explainer: workingScored.explainer,
            aiRecommendation: workingScored.aiRecommendation,
          },
        };
        emit({
          type: "partial",
          label: "Recovery densify ready",
          detail: "Re-running AI dual-view on ideal-close package…",
          evidenceScore: workingScored.score,
          dossier,
        });
        synthesis = await runSynthesis();
        applied = applyAiRoutes(synthesis);
      } catch (e) {
        emit({
          type: "log",
          stepId: "recover",
          label: "Ideal-close recovery failed",
          detail: e instanceof Error ? e.message : "recovery error",
        });
      }
    }

    if (!applied.ok) {
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
          confidence: workingScored.confidence,
          gaps: [
            ...(dossier.synthesis.gaps || []),
            applied.emptiedByGate
              ? "Quality gate rejected AI routes after ideal-close recovery — literature/patent leads only"
              : synthesis.rawError ||
                "Ollama did not return quality-gated routes — literature/patent leads only",
          ],
        },
      };
    }

    emit({
      type: applied.ok ? "step_done" : "step_error",
      stepId: "ollama",
      label: `${orgLabel} synthesis`,
      organization: orgLabel,
      endpointUrl: `${aiEnv.host}/api/chat`,
      method: "POST",
      ok: applied.ok,
      durationMs: Date.now() - tAi,
      responsePreview: previewText(
        synthesis.overview ||
          synthesis.rawError ||
          (applied.ok ? "JSON OK" : ""),
        320
      ),
      detail: applied.ok
        ? `Dual-view routes ready · AI confidence ${synthesis.confidence ?? "?"} · evidence ${workingScored.score} · ${synthesis.model}`
        : `${synthesis.rawError || "AI incomplete"} — evidence shell kept (recovery attempted)`,
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
  // Prefer identity-based small-molecule default over weak clinical text matches
  const modalityFromText = inferModalityFromText(modalityText || "small molecule", {
    name: dossier.identity?.name,
    formula: dossier.identity?.formula,
    molecularWeight: dossier.identity?.molecularWeight,
  });
  const modality =
    // Trust AI modality only when not a weak clinical misfire vs organic formula
    (dossier.synthesis.modality &&
    !(
      dossier.synthesis.modality === "cell-therapy" &&
      modalityFromText === "small-molecule"
    )
      ? dossier.synthesis.modality
      : undefined) ||
    dossier.modality ||
    modalityFromText;

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
  const procEx = evidence.procedureExcerpts || [];
  const procChars = procEx.reduce((n, p) => n + (p.chars || p.text?.length || 0), 0);
  const oaLitWindows = (dossier.literature || []).filter(
    (h) => (h.fullTextExcerpt?.length || 0) >= 80
  ).length;
  const patentWindows = (dossier.patents || []).filter(
    (h) => (h.procedureExcerpt?.length || 0) >= 80
  ).length;
  const pfBundle = dossier.processFacts || processFacts;
  const softFails = (evidence.fetchErrors || []).slice(0, 8);
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
    densifyQuality: {
      procedureExcerptCount: procEx.length,
      procedureChars: procChars,
      oaLitWindows,
      patentWindows,
      processFactConditions: pfBundle?.sourcedConditionCount ?? 0,
      unitOpFacts: pfBundle?.unitOpCount ?? 0,
      softFailHints: softFails.length ? softFails : undefined,
      // conditionObservations / knowledgeHypotheses filled after withProcessKnowledge
    },
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

  // Re-apply plant deliverables so BOM/related merge stays consistent
  dossier = applyPlantDeliverables(dossier);

  // Final quote-bind: match step condition tokens to process-fact quotes (all build modes)
  {
    const facts =
      dossier.processFacts?.facts || processFacts?.facts || evidence.processFacts?.facts;
    if (facts?.length && dossier.processRoutes?.length) {
      const qb = attachQuotesToRoutes(dossier.processRoutes, facts);
      if (qb.report.boundSteps > 0 || !dossier.groundingReport?.quoteBind) {
        dossier = {
          ...dossier,
          processRoutes: qb.routes,
          groundingReport: {
            checkedSteps: dossier.groundingReport?.checkedSteps ?? 0,
            strippedConditions: dossier.groundingReport?.strippedConditions ?? 0,
            ungroundedSnippets: dossier.groundingReport?.ungroundedSnippets ?? [],
            grounded: dossier.groundingReport?.grounded ?? qb.report.boundSteps > 0,
            summary: dossier.groundingReport?.summary
              ? `${dossier.groundingReport.summary} · ${qb.report.summary}`
              : qb.report.summary,
            quoteBind: qb.report,
          },
        };
      }
    }
  }

  // Product mode: scout-dossier vs recipe-draft (+ missing checklist)
  dossier = withRecipeReadiness(dossier);
  // Curated Tier-A ideal page depth score (north-star inventory)
  dossier = withIdealPageParity(dossier);
  // Frontier process-knowledge: condition atlas, hypotheses, experiments
  dossier = withProcessKnowledge(dossier);

  // Attach atlas/hypothesis/literature-depth counts now that process-knowledge exists
  if (dossier.buildAudit?.densifyQuality && dossier.processKnowledge) {
    dossier = {
      ...dossier,
      buildAudit: {
        ...dossier.buildAudit,
        densifyQuality: {
          ...dossier.buildAudit.densifyQuality,
          conditionObservations:
            dossier.processKnowledge.metrics.observationCount,
          knowledgeHypotheses: dossier.processKnowledge.metrics.hypothesisCount,
          literatureDepthScore:
            dossier.processKnowledge.metrics.literatureDepthScore,
          procedureRichWindows:
            dossier.processKnowledge.metrics.procedureRichWindows,
        },
        // duration includes knowledge attach
        durationMs: clock.elapsed(),
        finishedAt: new Date().toISOString(),
      },
    };
  }

  emit({
    type: "complete",
    label: "Dossier ready",
    detail: `Total ${clock.elapsed()} ms · Tier ${dossier.tier} · mode ${dossier.buildMode} · product ${dossier.productMode || "scout"} · ideal ${dossier.idealParity?.score ?? "—"}/100 · atlas ${dossier.processKnowledge?.metrics.observationCount ?? 0} obs · routes ${dossier.processRoutes.length} · ${modality}`,
    stepsDone: STEPS_TOTAL,
    stepsTotal: STEPS_TOTAL,
    evidenceScore: scored.score,
    dossier,
  });

  return dossier;
}
