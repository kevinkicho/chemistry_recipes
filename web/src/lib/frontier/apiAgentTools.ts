/**
 * Executable free-public API tools for the harvest agent.
 * Soft-fail rails stay; the agent chooses tools dynamically from harvest state.
 * Never invent plant numbers.
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import { extractProcessFacts } from "@/lib/dossier/processFacts";
import { scoreCompoundEvidence } from "@/lib/dossier/evidenceScore";
import {
  needsDensifyPass,
  runDensifyPass,
} from "@/lib/dossier/densifyPass";
import { retryFailedFamilies } from "@/lib/dossier/retryFailedFamilies";
import {
  countProcedureChars,
  countSoftFailures,
} from "@/lib/dossier/gatherResilience";
import { failedFamiliesFromErrors } from "@/lib/dossier/densifyDelta";
import { buildSourceFamilyReport } from "@/lib/dossier/sourceFamilyReport";
import { snapshotFromEvidence } from "@/lib/dossier/densifyDelta";
import { promoteAnnotationsToProcedureExcerpts } from "@/lib/dossier/annotationExcerpts";
import { circuitOpenHosts } from "@/lib/api/hostCircuit";
import { splitProcessVsClinicalLiterature } from "@/lib/literature/rank";
import {
  isFamilyRateLimited,
  listRateLimitStates,
  rateLimitedHosts,
  waitForAnyRateLimit,
  MAX_ETIQUETTE_WAIT_MS,
} from "@/lib/api/apiEtiquette";

export type ApiToolName =
  | "inspect_state"
  | "list_failed_families"
  | "list_rate_limits"
  | "wait_for_rate_limits"
  | "retry_failed_families"
  | "run_densify_pass"
  | "promote_annotations"
  | "compliance_check"
  | "reextract_process_facts"
  | "score_evidence"
  | "stop";

export type ApiToolCall = {
  tool: ApiToolName;
  /** Optional family labels for retry_failed_families */
  families?: string[];
  /** Optional max wait ms for wait_for_rate_limits */
  maxWaitMs?: number;
  reason?: string;
};

export type ApiToolResult = {
  tool: ApiToolName;
  ok: boolean;
  detail: string;
  evidence: CompoundEvidence;
  /** Structured payload for agent observation (no secrets) */
  observation?: Record<string, unknown>;
  /** Delta hint for reactive replan */
  improved?: boolean;
};

export type HarvestCompliance = {
  score: number;
  grade: "pass" | "soft" | "thin";
  checks: Array<{ id: string; ok: boolean; detail: string }>;
  freePublicOnly: true;
  inventPlantNumbers: false;
};

/** Free-public densify compliance — not GMP. */
export function assessHarvestCompliance(
  ev: CompoundEvidence
): HarvestCompliance {
  const scored = scoreCompoundEvidence(ev);
  const softFails = countSoftFailures(ev.fetchErrors);
  const procChars = countProcedureChars({
    procedureExcerpts: ev.procedureExcerpts,
    literature: ev.literature,
    patents: ev.patents,
    manufacturingTexts: ev.view?.manufacturingTexts,
  });
  const { process: processLit, clinical: clinicalLit } =
    splitProcessVsClinicalLiterature(ev.literature || []);
  const facts = (ev.processFacts?.facts || []).filter((f) => f.kind !== "open-gap");
  const checks: HarvestCompliance["checks"] = [
    {
      id: "identity",
      ok: Boolean(ev.identity),
      detail: ev.identity?.name
        ? `identity ${ev.identity.name}`
        : "no PubChem identity",
    },
    {
      id: "process-sources",
      ok: processLit.length + (ev.patents?.length || 0) + (ev.procedureExcerpts?.length || 0) > 0,
      detail: `${processLit.length} process lit · ${ev.patents?.length || 0} patents · ${ev.procedureExcerpts?.length || 0} excerpts`,
    },
    {
      id: "procedure-density",
      ok: procChars >= 400 || (ev.procedureExcerpts?.length || 0) >= 2,
      detail: `${procChars} proc chars · ${ev.procedureExcerpts?.length || 0} windows`,
    },
    {
      id: "process-vs-clinical",
      ok:
        processLit.length >= clinicalLit.length ||
        (ev.patents?.length || 0) > 0 ||
        processLit.length >= 2,
      detail: `process ${processLit.length} / clinical ${clinicalLit.length}`,
    },
    {
      id: "soft-fail-bound",
      ok: softFails < 12,
      detail: `${softFails} soft/api fail note(s)`,
    },
    {
      id: "atoms-or-honest-gaps",
      ok: facts.length >= 1 || (ev.processFacts?.openGaps?.length || 0) >= 1 || !ev.identity,
      detail: `${facts.length} atoms · ${(ev.processFacts?.openGaps || []).length} open gaps`,
    },
    {
      id: "evidence-score",
      ok: scored.score >= 25 || Boolean(ev.identity),
      detail: `score ${scored.score}/100 (${scored.confidence})`,
    },
    {
      id: "no-invention-rail",
      ok: true,
      detail: "harvest tools never invent plant setpoints (rail)",
    },
  ];
  const okN = checks.filter((c) => c.ok).length;
  const score = Math.round((okN / checks.length) * 100);
  const grade: HarvestCompliance["grade"] =
    score >= 75 ? "pass" : score >= 50 ? "soft" : "thin";
  return {
    score,
    grade,
    checks,
    freePublicOnly: true,
    inventPlantNumbers: false,
  };
}

export function inspectHarvestState(ev: CompoundEvidence): Record<string, unknown> {
  const snap = snapshotFromEvidence(ev);
  const scored = scoreCompoundEvidence(ev);
  const failed = failedFamiliesFromErrors(ev.fetchErrors || []);
  const families = buildSourceFamilyReport({
    traces: ev.traces,
    literatureCount: ev.literature?.length,
    patentCount: ev.patents?.length,
    annotationSources: (ev.annotations || []).map((a) => a.source),
    manufacturingCount: ev.view?.manufacturingTexts?.length,
    fetchErrors: ev.fetchErrors,
  });
  const compliance = assessHarvestCompliance(ev);
  const { process: processLit, clinical: clinicalLit } =
    splitProcessVsClinicalLiterature(ev.literature || []);
  const openCircuits = circuitOpenHosts();
  const rateLimits = listRateLimitStates();
  const rateLimited = rateLimitedHosts();
  const failedLabels = failed.map((f) => f.label);
  const rateLimitedFamilies = failedLabels.filter((f) => isFamilyRateLimited(f));
  return {
    cid: ev.cid,
    name: ev.identity?.name || null,
    hasIdentity: Boolean(ev.identity),
    softFails: countSoftFailures(ev.fetchErrors),
    procedureChars: snap.procedureChars,
    procedureExcerpts: snap.procedureExcerpts,
    processFactConditions: snap.processFactConditions,
    literature: ev.literature?.length || 0,
    processLit: processLit.length,
    clinicalLit: clinicalLit.length,
    patents: ev.patents?.length || 0,
    annotations: ev.annotations?.length || 0,
    evidenceScore: scored.score,
    confidence: scored.confidence,
    preferFastModel: scored.preferFastModel,
    needsDensify: needsDensifyPass(ev),
    failedFamilies: failedLabels,
    openCircuits,
    rateLimitedHosts: rateLimited,
    rateLimitedFamilies,
    rateLimits: rateLimits.slice(0, 12),
    etiquette:
      "Never thrash 429 hosts — skip or wait_for_rate_limits, then use alternate free-public families.",
    complianceScore: compliance.score,
    complianceGrade: compliance.grade,
    familyStatus: families.slice(0, 24).map((r) => ({
      family: r.family,
      status: r.status,
      hint: r.payloadHint,
    })),
    openGaps: (ev.processFacts?.openGaps || []).slice(0, 6),
  };
}

/**
 * Execute one harvest tool against current evidence.
 */
export async function executeApiTool(
  evidence: CompoundEvidence,
  call: ApiToolCall
): Promise<ApiToolResult> {
  const tool = call.tool;
  const beforeChars = countProcedureChars({
    procedureExcerpts: evidence.procedureExcerpts,
    literature: evidence.literature,
    patents: evidence.patents,
    manufacturingTexts: evidence.view?.manufacturingTexts,
  });
  const beforeScore = scoreCompoundEvidence(evidence).score;

  if (tool === "inspect_state") {
    const observation = inspectHarvestState(evidence);
    return {
      tool,
      ok: true,
      detail: `state · score ${observation.evidenceScore} · compliance ${observation.complianceGrade}(${observation.complianceScore}) · softFails ${observation.softFails} · proc ${observation.procedureChars} chars · densify=${observation.needsDensify}`,
      evidence,
      observation,
      improved: false,
    };
  }

  if (tool === "list_failed_families") {
    const failed = failedFamiliesFromErrors(evidence.fetchErrors || []);
    const openCircuits = circuitOpenHosts();
    const rateLimited = rateLimitedHosts();
    return {
      tool,
      ok: true,
      detail:
        failed.length > 0
          ? `failed families: ${failed.map((f) => f.label).join(", ")}${
              openCircuits.length ? ` · circuits: ${openCircuits.join(",")}` : ""
            }${rateLimited.length ? ` · rate-limited: ${rateLimited.join(",")}` : ""}`
          : "no soft/api-fail families recorded",
      evidence,
      observation: {
        families: failed.map((f) => f.label),
        openCircuits,
        rateLimitedHosts: rateLimited,
        rateLimitedFamilies: failed
          .map((f) => f.label)
          .filter((f) => isFamilyRateLimited(f)),
      },
      improved: false,
    };
  }

  if (tool === "list_rate_limits") {
    const rateLimits = listRateLimitStates();
    return {
      tool,
      ok: true,
      detail: rateLimits.length
        ? `rate limits: ${rateLimits
            .map(
              (r) =>
                `${r.host}${r.rateLimited ? " RL" : ""} ${Math.ceil(r.remainingMs / 1000)}s`
            )
            .join("; ")}`
        : "no active host rate-limit cooldowns",
      evidence,
      observation: { rateLimits, rateLimitedHosts: rateLimitedHosts() },
      improved: false,
    };
  }

  if (tool === "wait_for_rate_limits") {
    const maxWaitMs = Math.min(
      MAX_ETIQUETTE_WAIT_MS,
      Math.max(0, call.maxWaitMs ?? MAX_ETIQUETTE_WAIT_MS)
    );
    const waited = await waitForAnyRateLimit({ maxWaitMs });
    return {
      tool,
      ok: true,
      detail: waited.waitedMs
        ? `waited ${waited.waitedMs}ms for rate-limit cool-down · hosts ${waited.hosts.join(",") || "—"}`
        : "no rate-limit wait needed",
      evidence: {
        ...evidence,
        fetchErrors: [
          ...(evidence.fetchErrors || []),
          waited.waitedMs
            ? `api-agent · etiquette wait ${waited.waitedMs}ms · ${waited.hosts.join(",")}`
            : "api-agent · etiquette wait skipped (clear)",
        ].slice(0, 80),
      },
      observation: waited,
      improved: false,
    };
  }

  if (tool === "retry_failed_families") {
    try {
      // Skip families on open circuits OR active rate-limit cooldowns (etiquette)
      const open = new Set(circuitOpenHosts());
      const rateHosts = new Set(rateLimitedHosts());
      let families = call.families;
      const allCandidates =
        families?.length
          ? families
          : failedFamiliesFromErrors(evidence.fetchErrors || []).map((f) => f.label);
      const filtered = allCandidates.filter((f) => {
        if (isFamilyRateLimited(f)) return false;
        if (
          open.size &&
          [...open].some((h) => f.toLowerCase().includes(h.split(".")[0] || ""))
        )
          return false;
        if (
          rateHosts.size &&
          [...rateHosts].some((h) => f.toLowerCase().includes(h.split(".")[0] || ""))
        )
          return false;
        return true;
      });
      if (filtered.length) families = filtered;
      else if (allCandidates.some((f) => isFamilyRateLimited(f))) {
        return {
          tool,
          ok: false,
          detail:
            "retry skipped — remaining failed families are rate-limited (etiquette). Use wait_for_rate_limits or densify alternate sources.",
          evidence: {
            ...evidence,
            fetchErrors: [
              ...(evidence.fetchErrors || []),
              "api-agent · retry skipped · rate-limited hosts",
            ].slice(0, 80),
          },
          observation: {
            skipped: true,
            rateLimitedHosts: [...rateHosts],
            rateLimitedFamilies: allCandidates.filter((f) => isFamilyRateLimited(f)),
          },
          improved: false,
        };
      }
      const retry = await retryFailedFamilies(evidence, {
        families,
        name: evidence.identity?.name,
      });
      const next = {
        ...retry.evidence,
        fetchErrors: [
          ...(retry.evidence.fetchErrors || []),
          `api-agent · retry · ${retry.detail}`,
        ].slice(0, 80),
      };
      const afterScore = scoreCompoundEvidence(next).score;
      const afterChars = countProcedureChars({
        procedureExcerpts: next.procedureExcerpts,
        literature: next.literature,
        patents: next.patents,
        manufacturingTexts: next.view?.manufacturingTexts,
      });
      return {
        tool,
        ok: retry.retried.length > 0,
        detail: retry.detail,
        evidence: next,
        observation: {
          retried: retry.retried,
          stillFailed: retry.stillFailed,
          scoreDelta: afterScore - beforeScore,
          charsDelta: afterChars - beforeChars,
        },
        improved:
          retry.retried.length > 0 &&
          (afterScore > beforeScore || afterChars > beforeChars),
      };
    } catch (e) {
      return {
        tool,
        ok: false,
        detail: `retry failed: ${e instanceof Error ? e.message : "error"}`,
        evidence: {
          ...evidence,
          fetchErrors: [
            ...(evidence.fetchErrors || []),
            `api-agent · retry error: ${e instanceof Error ? e.message : "error"}`,
          ].slice(0, 80),
        },
        improved: false,
      };
    }
  }

  if (tool === "run_densify_pass") {
    try {
      const denseEnough =
        beforeChars >= 1800 && (evidence.procedureExcerpts?.length || 0) >= 4;
      const force = !denseEnough;
      if (!force && !needsDensifyPass(evidence)) {
        return {
          tool,
          ok: true,
          detail: `densify skipped · already dense (${beforeChars} proc chars)`,
          evidence,
          observation: { skipped: true, procedureChars: beforeChars },
          improved: false,
        };
      }
      const next0 = await runDensifyPass(evidence, { force });
      const afterChars = countProcedureChars({
        procedureExcerpts: next0.procedureExcerpts,
        literature: next0.literature,
        patents: next0.patents,
        manufacturingTexts: next0.view?.manufacturingTexts,
      });
      const next = {
        ...next0,
        fetchErrors: [
          ...(next0.fetchErrors || []),
          `api-agent · densify · ${beforeChars}→${afterChars} proc chars`,
        ].slice(0, 80),
      };
      return {
        tool,
        ok: true,
        detail: `densify pass · procedure ${beforeChars}→${afterChars} chars · excerpts ${next.procedureExcerpts?.length || 0}`,
        evidence: next,
        observation: {
          procedureCharsBefore: beforeChars,
          procedureCharsAfter: afterChars,
          excerpts: next.procedureExcerpts?.length || 0,
          forced: force,
        },
        improved: afterChars > beforeChars,
      };
    } catch (e) {
      return {
        tool,
        ok: false,
        detail: `densify failed: ${e instanceof Error ? e.message : "error"}`,
        evidence: {
          ...evidence,
          fetchErrors: [
            ...(evidence.fetchErrors || []),
            `api-agent · densify error: ${e instanceof Error ? e.message : "error"}`,
          ].slice(0, 80),
        },
        improved: false,
      };
    }
  }

  if (tool === "promote_annotations") {
    try {
      const beforeN = evidence.procedureExcerpts?.length || 0;
      const next0 = promoteAnnotationsToProcedureExcerpts(evidence);
      const afterN = next0.procedureExcerpts?.length || 0;
      const next = {
        ...next0,
        fetchErrors: [
          ...(next0.fetchErrors || []),
          `api-agent · promote annotations · ${beforeN}→${afterN} excerpts`,
        ].slice(0, 80),
      };
      return {
        tool,
        ok: afterN > beforeN,
        detail: `promoted annotations → procedure excerpts ${beforeN}→${afterN}`,
        evidence: next,
        observation: {
          before: beforeN,
          after: afterN,
          added: afterN - beforeN,
        },
        improved: afterN > beforeN,
      };
    } catch (e) {
      return {
        tool,
        ok: false,
        detail: `promote failed: ${e instanceof Error ? e.message : "error"}`,
        evidence,
        improved: false,
      };
    }
  }

  if (tool === "compliance_check") {
    const compliance = assessHarvestCompliance(evidence);
    return {
      tool,
      ok: compliance.grade !== "thin",
      detail: `compliance ${compliance.grade} ${compliance.score}/100 · ${compliance.checks
        .filter((c) => !c.ok)
        .map((c) => c.id)
        .join(",") || "all checks ok"}`,
      evidence,
      observation: { compliance },
      improved: false,
    };
  }

  if (tool === "reextract_process_facts") {
    const processFacts = extractProcessFacts(evidence);
    const next = { ...evidence, processFacts };
    return {
      tool,
      ok: true,
      detail: `re-extracted facts · ${processFacts.sourcedConditionCount} cond · ${processFacts.unitOpCount} ops · framing ${processFacts.framing}`,
      evidence: next,
      observation: {
        conditions: processFacts.sourcedConditionCount,
        unitOps: processFacts.unitOpCount,
        framing: processFacts.framing,
      },
      improved: processFacts.sourcedConditionCount > 0,
    };
  }

  if (tool === "score_evidence") {
    const scored = scoreCompoundEvidence(evidence);
    return {
      tool,
      ok: true,
      detail: `score ${scored.score}/100 (${scored.confidence}) · preferFast=${scored.preferFastModel}`,
      evidence,
      observation: {
        score: scored.score,
        confidence: scored.confidence,
        preferFastModel: scored.preferFastModel,
        reasons: scored.reasons.slice(0, 8),
      },
      improved: false,
    };
  }

  // stop
  return {
    tool: "stop",
    ok: true,
    detail: call.reason || "agent stop",
    evidence,
    observation: { stopped: true, reason: call.reason || "done" },
    improved: false,
  };
}

export const API_TOOL_CATALOG: Array<{
  name: ApiToolName;
  description: string;
}> = [
  {
    name: "inspect_state",
    description:
      "Read harvest snapshot: scores, compliance, soft-fails, open circuits, rate-limit cooldowns, process/clinical balance.",
  },
  {
    name: "list_failed_families",
    description:
      "List free-API families that soft-failed; note open circuits and rate-limited hosts.",
  },
  {
    name: "list_rate_limits",
    description:
      "List hosts under 429/etiquette cooldown. Prefer skipping those families over thrashing.",
  },
  {
    name: "wait_for_rate_limits",
    description:
      "Polite wait (capped) for rate-limit cooldown before retry. Prefer alternate sources first.",
  },
  {
    name: "retry_failed_families",
    description:
      "Re-query soft-failed free-public families (optional families[]). NEVER retries rate-limited hosts — skips them (etiquette).",
  },
  {
    name: "run_densify_pass",
    description:
      "Run densify pass (OA full text, patent procedures, OrgSyn) when procedure text is thin.",
  },
  {
    name: "promote_annotations",
    description:
      "Lift multi-source annotations (OrgSyn/ORD/KEGG/…) into procedure excerpt windows when thin.",
  },
  {
    name: "compliance_check",
    description:
      "Score free-public densify compliance (identity, process sources, density, soft-fail bound). Not GMP.",
  },
  {
    name: "reextract_process_facts",
    description: "Re-extract processFacts atoms from current densified evidence.",
  },
  {
    name: "score_evidence",
    description: "Compute process-evidence score / confidence / preferFast for dual-view gate.",
  },
  {
    name: "stop",
    description: "End harvest agent loop when dense enough, compliant, or no useful tools left.",
  },
];
